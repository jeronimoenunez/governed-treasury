const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const T = (n) => ethers.parseEther(String(n));

const DELAY = 72 * 60 * 60; 
const ONE_DAY = 24 * 60 * 60;

const LIMITS = {
  perTxLimit: T(1000), // máximo por operación
  dailyLimit: T(3000), // máximo por día
  approvalThreshold: T(500), // desde 500 se exige doble firma
  directDailyLimit: T(1000), // máximo por día sin doble firma
};

// ---------------------------------------------------------------------------
// Fixture: arma el escenario completo una vez y lo "fotografía".
// loadFixture vuelve a esa foto antes de cada test: rápido y sin interferencias.
// ---------------------------------------------------------------------------
async function deployFixture() {
  const [deployer, operator, approver, guardian, proposer, beneficiary, attacker] =
    await ethers.getSigners();

  const token = await ethers.deployContract("MockToken");

  // Timelock: proposer programa y ejecuta; el deployer es admin temporal.
  const timelock = await ethers.deployContract("GovernanceTimelock", [
    DELAY,
    [proposer.address],
    [proposer.address],
    deployer.address,
  ]);
  // El guardián puede cancelar operaciones programadas.
  await timelock.grantRole(await timelock.CANCELLER_ROLE(), guardian.address);
  // El deployer renuncia: nadie queda con poder de admin sobre el timelock.
  await timelock.renounceRole(await timelock.DEFAULT_ADMIN_ROLE(), deployer.address);

  const treasury = await ethers.deployContract("GovernedTreasury", [
    await token.getAddress(),
    await timelock.getAddress(),
    operator.address,
    approver.address,
    guardian.address,
    [beneficiary.address],
    LIMITS,
  ]);

  // Fondeo de la tesorería con 10.000 tokens.
  await token.mint(deployer.address, T(10000));
  await token.approve(await treasury.getAddress(), T(10000));
  await treasury.deposit(T(10000));

  // Hace pasar una llamada por el timelock completo (programar, esperar, ejecutar).
  async function viaTimelock(fn, args) {
    const target = await treasury.getAddress();
    const data = treasury.interface.encodeFunctionData(fn, args);
    const salt = ethers.hexlify(ethers.randomBytes(32));
    await timelock.connect(proposer).schedule(target, 0, data, ethers.ZeroHash, salt, DELAY);
    await time.increase(DELAY);
    await timelock.connect(proposer).execute(target, 0, data, ethers.ZeroHash, salt);
  }

  return {
    token, timelock, treasury, viaTimelock,
    deployer, operator, approver, guardian, proposer, beneficiary, attacker,
  };
}

describe("GovernedTreasury", function () {
  // =========================================================================
  describe("Despliegue", function () {
    it("reparte los roles y el deployer no se queda con ninguno", async function () {
      const { treasury, timelock, deployer, operator, approver, guardian } =
        await loadFixture(deployFixture);

      expect(await treasury.hasRole(await treasury.DEFAULT_ADMIN_ROLE(), await timelock.getAddress())).to.equal(true);
      expect(await treasury.hasRole(await treasury.OPERATOR_ROLE(), operator.address)).to.equal(true);
      expect(await treasury.hasRole(await treasury.APPROVER_ROLE(), approver.address)).to.equal(true);
      expect(await treasury.hasRole(await treasury.GUARDIAN_ROLE(), guardian.address)).to.equal(true);
      expect(await treasury.hasRole(await treasury.DEFAULT_ADMIN_ROLE(), deployer.address)).to.equal(false);
    });

    it("rechaza configuraciones inválidas en el constructor", async function () {
      const { token, timelock, operator, approver, guardian } = await loadFixture(deployFixture);
      const F = await ethers.getContractFactory("GovernedTreasury");
      const tk = await token.getAddress();
      const tl = await timelock.getAddress();

      await expect(F.deploy(ethers.ZeroAddress, tl, operator.address, approver.address, guardian.address, [], LIMITS))
        .to.be.revertedWithCustomError(F, "ZeroAddress");
      await expect(F.deploy(operator.address, tl, operator.address, approver.address, guardian.address, [], LIMITS))
        .to.be.revertedWithCustomError(F, "NotAContract");
      await expect(F.deploy(tk, tl, operator.address, operator.address, guardian.address, [], LIMITS))
        .to.be.revertedWithCustomError(F, "RolesMustBeDistinct");
      await expect(F.deploy(tk, tl, operator.address, approver.address, guardian.address, [], { ...LIMITS, approvalThreshold: T(2000) }))
        .to.be.revertedWithCustomError(F, "InvalidLimits");
      await expect(F.deploy(tk, tl, operator.address, approver.address, guardian.address, [], { ...LIMITS, directDailyLimit: 0 }))
        .to.be.revertedWithCustomError(F, "InvalidLimits");
    });
  });

  // =========================================================================
  describe("Depósito", function () {
    it("acepta depósitos y emite Deposited", async function () {
      const { token, treasury, attacker } = await loadFixture(deployFixture);
      await token.mint(attacker.address, T(50));
      await token.connect(attacker).approve(await treasury.getAddress(), T(50));

      await expect(treasury.connect(attacker).deposit(T(50)))
        .to.emit(treasury, "Deposited").withArgs(attacker.address, T(50));
      expect(await token.balanceOf(await treasury.getAddress())).to.equal(T(10050));
    });

    it("rechaza monto cero", async function () {
      const { treasury } = await loadFixture(deployFixture);
      await expect(treasury.deposit(0)).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });
  });

  // =========================================================================
  describe("Retiro directo (sin doble firma)", function () {
    it("el operador retira un monto chico hacia un beneficiario habilitado", async function () {
      const { token, treasury, operator, beneficiary } = await loadFixture(deployFixture);

      await expect(treasury.connect(operator).withdraw(beneficiary.address, T(100)))
        .to.emit(treasury, "Withdrawn").withArgs(beneficiary.address, T(100), operator.address);
      expect(await token.balanceOf(beneficiary.address)).to.equal(T(100));
    });

    it("exige doble firma desde el umbral", async function () {
      const { treasury, operator, beneficiary } = await loadFixture(deployFixture);
      await expect(treasury.connect(operator).withdraw(beneficiary.address, T(500)))
        .to.be.revertedWithCustomError(treasury, "RequiresApproval").withArgs(T(500), T(500));
    });

    it("rechaza monto cero", async function () {
      const { treasury, operator, beneficiary } = await loadFixture(deployFixture);
      await expect(treasury.connect(operator).withdraw(beneficiary.address, 0))
        .to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });
  });

  // =========================================================================
  describe("ATAQUE: control de acceso", function () {
    it("una cuenta sin rol no puede retirar", async function () {
      const { treasury, attacker, beneficiary } = await loadFixture(deployFixture);
      await expect(treasury.connect(attacker).withdraw(beneficiary.address, T(1)))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    });

    it("el operador no puede aprobar y el aprobador no puede pedir", async function () {
      const { treasury, operator, approver, beneficiary } = await loadFixture(deployFixture);
      await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(600));

      await expect(treasury.connect(operator).approveWithdrawal(0))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
      await expect(treasury.connect(approver).requestWithdrawal(beneficiary.address, T(600)))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    });

    it("nadie cambia la configuración sin pasar por el timelock", async function () {
      const { treasury, operator, guardian, attacker } = await loadFixture(deployFixture);
      for (const signer of [operator, guardian, attacker]) {
        await expect(treasury.connect(signer).setBeneficiary(attacker.address, true))
          .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
        await expect(treasury.connect(signer).setLimits(LIMITS))
          .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
      }
    });
  });

  // =========================================================================
  describe("ATAQUE: destinos y límites", function () {
    it("no se puede enviar a una dirección fuera de la allowlist", async function () {
      const { treasury, operator, attacker } = await loadFixture(deployFixture);
      await expect(treasury.connect(operator).withdraw(attacker.address, T(10)))
        .to.be.revertedWithCustomError(treasury, "BeneficiaryNotAllowed").withArgs(attacker.address);
    });

    it("fraccionar retiros para evitar la doble firma queda bloqueado", async function () {
      const { treasury, operator, beneficiary } = await loadFixture(deployFixture);
      // 499 + 499 = 998 <= 1000 (tope directo). El tercero lo supera.
      await treasury.connect(operator).withdraw(beneficiary.address, T(499));
      await treasury.connect(operator).withdraw(beneficiary.address, T(499));

      await expect(treasury.connect(operator).withdraw(beneficiary.address, T(499)))
        .to.be.revertedWithCustomError(treasury, "ExceedsDirectDailyLimit").withArgs(T(1497), T(1000));
    });

    it("respeta el tope diario general (con error propio, no panic) y se renueva al día siguiente", async function () {
      const { treasury, operator, approver, beneficiary } = await loadFixture(deployFixture);
      for (let i = 0; i < 3; i++) {
        await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(1000));
        await treasury.connect(approver).approveWithdrawal(i);
      }
      await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(500));
      await expect(treasury.connect(approver).approveWithdrawal(3))
        .to.be.revertedWithCustomError(treasury, "ExceedsDailyLimit").withArgs(T(3500), T(3000));

      await time.increase(ONE_DAY);
      await expect(treasury.connect(approver).approveWithdrawal(3)).to.not.be.reverted;
    });

    it("rechaza montos sobre el límite por operación", async function () {
      const { treasury, operator, beneficiary } = await loadFixture(deployFixture);
      await expect(treasury.connect(operator).requestWithdrawal(beneficiary.address, T(1001)))
        .to.be.revertedWithCustomError(treasury, "ExceedsPerTxLimit").withArgs(T(1001), T(1000));
    });

    it("informa lo que queda disponible hoy", async function () {
      const { treasury, operator, beneficiary } = await loadFixture(deployFixture);
      await treasury.connect(operator).withdraw(beneficiary.address, T(300));
      const [total, direct] = await treasury.remainingToday();
      expect(total).to.equal(T(2700));
      expect(direct).to.equal(T(700));
    });
  });

  // =========================================================================
  describe("Doble firma (maker-checker)", function () {
    it("flujo completo: el operador pide, el aprobador firma y se ejecuta", async function () {
      const { token, treasury, operator, approver, beneficiary } = await loadFixture(deployFixture);

      await expect(treasury.connect(operator).requestWithdrawal(beneficiary.address, T(800)))
        .to.emit(treasury, "WithdrawalRequested").withArgs(0, beneficiary.address, T(800), operator.address);
      expect(await token.balanceOf(beneficiary.address)).to.equal(0); 

      await expect(treasury.connect(approver).approveWithdrawal(0))
        .to.emit(treasury, "WithdrawalRequestApproved").withArgs(0, approver.address)
        .and.to.emit(treasury, "Withdrawn").withArgs(beneficiary.address, T(800), operator.address);
      expect(await token.balanceOf(beneficiary.address)).to.equal(T(800));

      // La doble firma no consume el tope de retiros directos
      const [, direct] = await treasury.remainingToday();
      expect(direct).to.equal(T(1000));
    });

    it("los montos chicos van por el retiro directo", async function () {
      const { treasury, operator, beneficiary } = await loadFixture(deployFixture);
      await expect(treasury.connect(operator).requestWithdrawal(beneficiary.address, T(100)))
        .to.be.revertedWithCustomError(treasury, "BelowApprovalThreshold");
    });

    it("ATAQUE: quien pide no puede aprobar su propio pedido", async function () {
      const { treasury, operator, beneficiary, viaTimelock } = await loadFixture(deployFixture);
      // El operador también se le da el rol de aprobador.
      await viaTimelock("grantRole", [await treasury.APPROVER_ROLE(), operator.address]);

      await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(600));
      await expect(treasury.connect(operator).approveWithdrawal(0))
        .to.be.revertedWithCustomError(treasury, "SelfApprovalNotAllowed");
    });

    it("ATAQUE: no se puede aprobar dos veces el mismo pedido", async function () {
      const { treasury, operator, approver, beneficiary } = await loadFixture(deployFixture);
      await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(600));
      await treasury.connect(approver).approveWithdrawal(0);

      await expect(treasury.connect(approver).approveWithdrawal(0))
        .to.be.revertedWithCustomError(treasury, "NotPending");
    });

    it("una orden vencida no se puede aprobar", async function () {
      const { treasury, operator, approver, beneficiary } = await loadFixture(deployFixture);
      await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(600));
      await time.increase(3 * ONE_DAY + 1);

      await expect(treasury.connect(approver).approveWithdrawal(0))
        .to.be.revertedWithCustomError(treasury, "RequestExpired");
    });

    it("se revalida al aprobar: si revocaron al beneficiario, no se paga", async function () {
      const { treasury, operator, approver, guardian, beneficiary } = await loadFixture(deployFixture);
      await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(600));
      await treasury.connect(guardian).revokeBeneficiary(beneficiary.address);

      await expect(treasury.connect(approver).approveWithdrawal(0))
        .to.be.revertedWithCustomError(treasury, "BeneficiaryNotAllowed");
    });

    it("rechazan el aprobador, el guardián o el propio solicitante; un tercero no", async function () {
      const { treasury, operator, approver, guardian, attacker, beneficiary } = await loadFixture(deployFixture);
      for (let i = 0; i < 3; i++) {
        await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(600));
      }
      await expect(treasury.connect(attacker).rejectWithdrawal(0))
        .to.be.revertedWithCustomError(treasury, "NotAuthorizedToReject").withArgs(attacker.address);

      await expect(treasury.connect(approver).rejectWithdrawal(0))
        .to.emit(treasury, "WithdrawalRejected").withArgs(0, approver.address);
      await treasury.connect(guardian).rejectWithdrawal(1);
      await treasury.connect(operator).rejectWithdrawal(2);

      await expect(treasury.connect(approver).approveWithdrawal(2))
        .to.be.revertedWithCustomError(treasury, "NotPending");
    });
  });

  // =========================================================================
  describe("Emergencia: restringir es rápido, ampliar es lento", function () {
    it("la pausa bloquea operaciones pero permite rechazar pedidos", async function () {
      const { treasury, operator, guardian, beneficiary } = await loadFixture(deployFixture);
      await treasury.connect(operator).requestWithdrawal(beneficiary.address, T(600));
      await treasury.connect(guardian).pause();

      await expect(treasury.connect(operator).withdraw(beneficiary.address, T(1)))
        .to.be.revertedWithCustomError(treasury, "EnforcedPause");
      await expect(treasury.deposit(T(1))).to.be.revertedWithCustomError(treasury, "EnforcedPause");
      await expect(treasury.connect(guardian).rejectWithdrawal(0)).to.not.be.reverted;
    });

    it("el guardián no puede reanudar: eso pasa por el timelock", async function () {
      const { treasury, guardian, viaTimelock } = await loadFixture(deployFixture);
      await treasury.connect(guardian).pause();

      await expect(treasury.connect(guardian).unpause())
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
      await viaTimelock("unpause", []);
      expect(await treasury.paused()).to.equal(false);
    });

    it("el guardián revoca beneficiarios al instante pero no puede habilitarlos", async function () {
      const { treasury, operator, guardian, beneficiary } = await loadFixture(deployFixture);
      await expect(treasury.connect(guardian).revokeBeneficiary(beneficiary.address))
        .to.emit(treasury, "BeneficiaryUpdated").withArgs(beneficiary.address, false);

      await expect(treasury.connect(operator).withdraw(beneficiary.address, T(1)))
        .to.be.revertedWithCustomError(treasury, "BeneficiaryNotAllowed");
      await expect(treasury.connect(guardian).setBeneficiary(beneficiary.address, true))
        .to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    });
  });

  // =========================================================================
  describe("ATAQUE: admin comprometido vs timelock", function () {
    it("un cambio no se puede ejecutar antes de 72 horas", async function () {
      const { treasury, timelock, proposer, attacker } = await loadFixture(deployFixture);
      const target = await treasury.getAddress();
      const data = treasury.interface.encodeFunctionData("setBeneficiary", [attacker.address, true]);

      await timelock.connect(proposer).schedule(target, 0, data, ethers.ZeroHash, ethers.ZeroHash, DELAY);
      await time.increase(DELAY - 60);

      await expect(timelock.connect(proposer).execute(target, 0, data, ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
    });

    it("el guardián cancela un cambio sospechoso durante la espera", async function () {
      const { treasury, timelock, proposer, guardian, attacker } = await loadFixture(deployFixture);
      const target = await treasury.getAddress();
      const data = treasury.interface.encodeFunctionData("setBeneficiary", [attacker.address, true]);

      await timelock.connect(proposer).schedule(target, 0, data, ethers.ZeroHash, ethers.ZeroHash, DELAY);
      const id = await timelock.hashOperation(target, 0, data, ethers.ZeroHash, ethers.ZeroHash);
      await timelock.connect(guardian).cancel(id);

      await time.increase(DELAY);
      await expect(timelock.connect(proposer).execute(target, 0, data, ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
      expect(await treasury.isAllowedBeneficiary(attacker.address)).to.equal(false);
    });

    it("pasadas las 72 horas, los cambios legítimos se aplican", async function () {
      const { treasury, viaTimelock, attacker } = await loadFixture(deployFixture);
      const nuevos = { perTxLimit: T(2000), dailyLimit: T(5000), approvalThreshold: T(100), directDailyLimit: T(300) };
      await viaTimelock("setLimits", [nuevos]);
      expect((await treasury.limits()).approvalThreshold).to.equal(T(100));

      const nuevoBeneficiario = attacker.address;
      await viaTimelock("setBeneficiary", [nuevoBeneficiario, true]);
      expect(await treasury.isAllowedBeneficiary(nuevoBeneficiario)).to.equal(true);
    });
  });

  // =========================================================================
  describe("ATAQUE: reentrancy", function () {
    it("un token malicioso que intenta reentrar es bloqueado por nonReentrant", async function () {
      const { timelock, approver, guardian, beneficiary } = await loadFixture(deployFixture);
      const evil = await ethers.deployContract("MaliciousToken");

      // Peor caso: el operador es el propio contrato atacante.
      const treasury = await ethers.deployContract("GovernedTreasury", [
        await evil.getAddress(), await timelock.getAddress(), await evil.getAddress(),
        approver.address, guardian.address, [beneficiary.address], LIMITS,
      ]);
      await evil.mint(await treasury.getAddress(), T(1000));
      await evil.setTarget(await treasury.getAddress(), beneficiary.address);

      await expect(evil.attack(T(100)))
        .to.be.revertedWithCustomError(treasury, "ReentrancyGuardReentrantCall");
      expect(await evil.balanceOf(await treasury.getAddress())).to.equal(T(1000));
    });
  });
});