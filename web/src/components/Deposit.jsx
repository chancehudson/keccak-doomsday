import React from "react";
import { observer } from "mobx-react-lite";
import state from "../state/state";
import convert from "ethereum-unit-converter";

export default observer(() => {
  const { contract } = React.useContext(state);
  const [amount, setAmount] = React.useState("");
  return (
    <div style={{}}>
      <h2>Deposit</h2>
      <div>Deposit Ether to increase the bounty for breaking Keccak256!</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
        }}
      >
        <input
          placeholder="0 (gwei)"
          type="text"
          value={amount}
          style={{ marginBottom: "4px" }}
          onChange={(e) => {
            if (e.target.value.match(/^[0-9]*$/)) {
              setAmount(e.target.value);
            }
          }}
        />
        {amount ? <div>{convert(amount, "gwei").ether} ether</div> : null}
        <button
          onClick={async () => {
            try {
              await contract.deposit(convert(amount, "gwei").wei);
              setAmount("");
              await Promise.all([
                contract.loadBalance(),
                contract.loadExpectedReward(),
              ]);
            } catch (err) {
              console.log("transaction error", err);
            }
          }}
        >
          deposit
        </button>
      </div>
    </div>
  );
});
