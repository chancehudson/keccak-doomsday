// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// deposit ether
// claim pre-image
// payout at end of time
contract KeccakDoomsday is ERC20 {
    // a hash and a number of bits that must be
    // collided in order to claim a payout
    struct HashTarget {
        bytes32 hash;
        uint8 bits;
        bool claimed;
        address payable claimedBy;
    }
    // a claim being made by a user saying they
    // collided a HashTarget. This is done in two
    // steps to avoid frontrunning, see beginClaim
    // and finishClaim below
    struct Claim {
        uint256 validUntil;
        bytes32 commitValue;
        bytes32 preImage;
        address payable claimant;
    }

    mapping(uint8 => HashTarget) public targets;
    bytes32 public immutable rootHash;
    mapping(bytes32 => Claim) public claims;
    uint256 public balance;
    uint256 public finalWeiPerToken;
    uint256 public immutable startTime;
    uint256 public immutable HALT_TIMEOUT = 10 * 365 * 24 * 60 * 60;
    bool public halted;
    uint8 public bitCount;
    uint8 public startBits;

    uint256 public immutable CLAIM_TIMEOUT = 24 hours;
    uint256 public immutable WEI_PER_TOKEN = 1 gwei;

    event HashClaimed(uint8 bits, address claimedBy, uint256 weiClaimed);

    // initialize the contract with a rootHash and a bit range for
    // which bounties are available
    //
    // each hash target is 1 bit away from the previous (e.g. add 1
    // to the previous has target). This is to also put a bounty on
    // collisions by proximity. e.g. if someone finds a way to find
    // pre-images with outputs near each other we want to know
    constructor(
        bytes32 _rootHash,
        uint8 _startBits,
        uint8 len
    ) ERC20("KeccakDoomsday", "KDD") {
        startTime = block.timestamp;
        rootHash = _rootHash;
        bitCount = len;
        startBits = _startBits;
        for (uint8 x = _startBits; x < _startBits + len; x++) {
            targets[x] = HashTarget({
                hash: bytes32(uint256(rootHash) + uint256(x)),
                bits: x,
                claimed: false,
                claimedBy: payable(address(uint160(0)))
            });
        }
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function expectedReward() public view returns (uint256) {
        return balance / (bitCount - claimedCount());
    }

    function nextTarget() public view returns (HashTarget memory) {
        for (uint8 x = startBits; x < startBits + bitCount; x++) {
            if (!targets[x].claimed) {
                return targets[x];
            }
        }
        return
            HashTarget({
                hash: bytes32(0),
                bits: 0,
                claimed: false,
                claimedBy: payable(address(uint160(0)))
            });
    }

    function claimedCount() public view returns (uint8) {
        uint8 count = 0;
        for (uint8 x = startBits; x < startBits + bitCount; x++) {
            if (targets[x].claimed) {
                count++;
            }
        }
        return count;
    }

    // the time at which bounties are removed and funds are
    // returned to token holders
    function endTime() public view returns (uint256) {
        return startTime + HALT_TIMEOUT;
    }

    // hashes are claimed in a two step process
    // T = target hash value
    // H = hash function
    // i = T pre-image
    // 1. claimant commits to a hash H(i + 1)
    // 2. claimant provides a pre-image corresponding to H(i + 1)
    //    i is the pre-image that collides with the target
    function beginClaim(bytes32 commitValue, address payable claimant) public {
        haltIfNeeded();
        require(!halted, "contract is halted");
        require(
            claims[commitValue].validUntil == 0 ||
                block.timestamp > claims[commitValue].validUntil,
            "claim already exists"
        );
        claims[commitValue] = Claim({
            validUntil: block.timestamp + CLAIM_TIMEOUT,
            commitValue: commitValue,
            preImage: 0,
            claimant: claimant
        });
    }

    // finish a claim that was start above. Check that the pre-image
    // actually collides with the target and that it has not already
    // been claimed
    function finishClaim(bytes32 preImage, uint8 bits) public {
        haltIfNeeded();
        require(!halted, "contract is halted");
        bytes32 claimHash = keccak256(
            abi.encodePacked(bytes32(uint256(preImage) + 1))
        );
        require(
            claims[claimHash].validUntil > block.timestamp,
            "claim has expired or does not exist"
        );
        bytes32 hash = keccak256(abi.encodePacked(preImage));
        HashTarget storage target = targets[bits];
        require(target.hash != bytes32(0), "target not enabled");
        require(target.bits == bits, "bit mismatch");
        require(target.claimed == false, "target has already been claimed");
        bytes32 mask = bytes32(~(type(uint256).max << bits));
        require((hash & mask) == (target.hash & mask), "hash mismatch");
        uint256 claimAmount = expectedReward();
        target.claimed = true;
        balance -= claimAmount;
        claims[claimHash].claimant.transfer(claimAmount);
        emit HashClaimed(bits, claims[claimHash].claimant, claimAmount);
    }

    // if the end of the clock is reached
    // prevent deposits, claims, and allow
    // withdrawals
    function haltIfNeeded() public {
        if (!halted && block.timestamp >= endTime()) {
            halted = true;
            if (totalSupply() > 0) {
                finalWeiPerToken = balance / totalSupply();
            }
        }
    }

    function withdrawFrom(
        uint256 value,
        address owner,
        address payable destination
    ) public {
        haltIfNeeded();
        require(halted, "contract is not halted");
        _spendAllowance(owner, msg.sender, value);
        _update(owner, address(0), value);
        destination.transfer(value * finalWeiPerToken);
    }

    // withdraw some ether using tokens, only available
    // after the endTime has been reached
    function withdraw(uint256 value, address payable destination) public {
        haltIfNeeded();
        require(halted, "contract is not halted");
        _update(msg.sender, address(0), value);
        destination.transfer(value * finalWeiPerToken);
    }

    // deposit ether and receive tokens
    function deposit() public payable {
        haltIfNeeded();
        require(!halted, "contract is halted");
        require(msg.value >= WEI_PER_TOKEN, "invalid deposit value");
        balance += msg.value;
        _mint(msg.sender, msg.value / WEI_PER_TOKEN);
    }
}
