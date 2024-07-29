import { createContext } from "react";
import ContractState from "./contract";
import { configure } from "mobx";
configure({
  enforceActions: "never",
});

export const buildState = () => {
  const state = {};

  const contract = new ContractState(state);

  Object.assign(state, {
    contract,
  });
  state.loadPromise = Promise.all([contract.loadPromise]);
  return state;
};

export default createContext(buildState());
