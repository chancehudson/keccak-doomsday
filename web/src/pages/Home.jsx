import React from "react";
import ethers from "ethers";

export default () => {
  const CONTRACT_ADDRESS = "0x241EBDd1Da86e4C7F619768187C1a1192DE4174F";
  const PROVIDER_URL =
    "https://eth-sepolia.g.alchemy.com/v2/SMH5q-gqe7zv8J7BR6OQRZiCd9I8r3le";

  return (
    <div style={{ maxWidth: "500px" }}>
      <h2>Keccak Doomsday</h2>
      <p>Put a bounty on progressively breaking the Keccak hash function!</p>
      <h4>Why?</h4>
      <p>
        Ethereum relies on the Keccak256 hash function for a lot of things. It's
        probably a good idea to incentivize a public tracker for how much of the
        function has been broken.
      </p>
      <h4>Does this actually break Keccak?</h4>
      <p>
        Well, no. This device simply tracks how quickly computation power is
        increasing.
      </p>
      <h4>How does the bounty work?</h4>
      <p>
        Anyone can send Ether to the contract and receive KDD tokens in return.
        As the hash function is broken the Ether is paid out to those that prove
        they broke it. After 10 years the contract halts and any remaining Ether
        is returned to the token holders.
      </p>
    </div>
  );
};
