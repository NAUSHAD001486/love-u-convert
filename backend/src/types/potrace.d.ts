declare module 'potrace' {
  export interface PotraceOptions {
    turdSize?: number;
    optTolerance?: number;
    turnPolicy?: string;
    alphaMax?: number;
    color?: string;
    background?: string;
  }

  export function trace(
    buffer: Buffer,
    options: PotraceOptions,
    callback: (err: Error | null, svg: string) => void
  ): void;
}

