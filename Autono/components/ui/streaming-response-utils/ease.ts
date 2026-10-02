export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const SPRING_PRESS = {
  type: "spring" as const,
  stiffness: 400,
  damping: 25,
};

export const SPRING_SWAP = {
  type: "spring" as const,
  stiffness: 350,
  damping: 28,
};
