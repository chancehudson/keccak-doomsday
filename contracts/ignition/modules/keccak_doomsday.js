const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const hash =
  "0x80460dacc7ad85e36437855831c111389bb09706c07ae9d21ac1c6e6e20adf3c";

const KeccakDoomsdayModule = buildModule("KeccakDoomsday", (m) => {
  // const unlockTime = m.getParameter("unlockTime", JAN_1ST_2030);
  // const lockedAmount = m.getParameter("lockedAmount", ONE_GWEI);

  const lock = m.contract("KeccakDoomsday", [hash, 20, 50]);

  return { lock };
});

module.exports = KeccakDoomsdayModule;
