// Polar shape functions: given (theta, time) -> radius multiplier ~1.0
export type RadialFn = (theta: number, time: number) => number;

const clamp = (v:number, a:number, b:number)=>Math.max(a,Math.min(b,v));

/** organic base blob driven by time */
export const baseBlob = (seed = 0): RadialFn => {
  return (th, t) => {
    const a = Math.sin(th*3 + t*0.7 + seed) * 0.50;
    const b = Math.sin(th*5 - t*0.45 + seed*2) * 0.28;
    const c = Math.sin(th*7 + t*0.2  + seed*3) * 0.18;
    return clamp(1 + (a+b+c)*0.35, 0.72, 1.35);
  };
};

/** 5-point star */
export const star: RadialFn = (th, t) => {
  const k = Math.cos(th*5);
  return clamp(1 + 0.38*k, 0.78, 1.30);
};

/** heart-ish polar curve */
export const heart: RadialFn = (th) => {
  // normal heart is centered at top; rotate to look nice
  const a = th - Math.PI/2;
  const r = 1 - Math.sin(a);
  return clamp(0.85 + (1/r)*0.18, 0.75, 1.35);
};

/** diamond / rhombus */
export const diamond: RadialFn = (th) => {
  const k = Math.abs(Math.cos(th)) + Math.abs(Math.sin(th));
  return clamp(1.15 / k, 0.78, 1.30);
};

/** cat-ears: orb + bumps at top */
export const cat: RadialFn = (th, t) => {
  const base = 1.0 + Math.sin(th*4 + t*0.6)*0.06;
  const ear1 = Math.exp(-((th - (-0.55))**2)/0.05)*0.22;
  const ear2 = Math.exp(-((th - ( 0.55))**2)/0.05)*0.22;
  return clamp(base + ear1 + ear2, 0.80, 1.40);
};

export const shapes: Record<string, RadialFn> = {
  orb: baseBlob(0.0),
  star, heart, diamond, cat,
};

export function getShape(name: string): RadialFn {
  return shapes[name] || shapes.orb;
}
