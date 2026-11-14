export interface VirtualInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  boost: boolean;
  jump: boolean;
}

export const virtualInput: VirtualInputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  boost: false,
  jump: false,
};

export function setVirtualKey(key: keyof VirtualInputState, active: boolean) {
  virtualInput[key] = active;
}

export function resetVirtualInput() {
  virtualInput.left = false;
  virtualInput.right = false;
  virtualInput.up = false;
  virtualInput.down = false;
  virtualInput.boost = false;
  virtualInput.jump = false;
}
