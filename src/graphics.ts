import { WebGLRenderer } from 'three'

export class WebGLContextError extends Error {
  constructor() {
    super('The browser could not create a WebGL 2 context.')
  }
}

export function createRenderer(antialias: boolean, alpha = false) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('webgl2', {
    alpha,
    antialias,
    powerPreference: 'low-power',
    // Low power changes the scene budget. It should never veto a usable context.
    failIfMajorPerformanceCaveat: false,
  })
  if (!context) throw new WebGLContextError()
  return new WebGLRenderer({ canvas, context, alpha, antialias })
}
