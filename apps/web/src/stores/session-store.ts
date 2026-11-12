import { create } from "zustand";

export type SessionIdentity = {
  id: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};

type SessionState = {
  accessToken: string | null;
  identity: SessionIdentity | null;
  setSession: (accessToken: string, identity: SessionIdentity) => void;
  setIdentity: (identity: SessionIdentity) => void;
  rotateAccessToken: (accessToken: string | null) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  identity: null,
  setSession: (accessToken, identity) => set({ accessToken, identity }),
  setIdentity: (identity) => set({ identity }),
  rotateAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ accessToken: null, identity: null }),
}));
