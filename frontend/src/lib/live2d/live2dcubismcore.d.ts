/**
 * Ambient type declaration for Live2D Cubism Core (proprietary WebGL runtime).
 *
 * The runtime itself is the official file `live2dcubismcore.min.js`
 * (Live2D Proprietary Software License; the three core files are explicitly
 * listed as redistributable in the SDK's `Core/RedistributableFiles.txt`),
 * served locally from `frontend/public/live2d/core/live2dcubismcore.min.js`.
 *
 * The real Core API surface is large and version-dependent. This declaration is
 * intentionally permissive (index signatures) so the vendored official
 * Cubism Web Framework keeps compiling; runtime behaviour comes from the
 * official Core binary, not from this file.
 */
declare namespace Live2DCubismCore {
  class Moc {
    static fromArrayBuffer(buffer: ArrayBuffer): Moc
    hasMocConsistency(buffer: ArrayBuffer): boolean
    [key: string]: any
  }

  class Model {
    static fromMoc(moc: Moc, ...args: any[]): Model
    [key: string]: any
  }

  const Version: any
  const Logging: any
  const Memory: any
  const Utils: any

  type csmLogFunction = (message: string) => void
  type csmParameterType = number

  const ColorBlendType_Normal: number
  const ColorBlendType_AddGlow: number
  const ColorBlendType_Add: number
  const ColorBlendType_Darken: number
  const ColorBlendType_Multiply: number
  const ColorBlendType_ColorBurn: number
  const ColorBlendType_LinearBurn: number
  const ColorBlendType_Lighten: number
  const ColorBlendType_Screen: number
  const ColorBlendType_ColorDodge: number
  const ColorBlendType_Overlay: number
  const ColorBlendType_SoftLight: number
  const ColorBlendType_HardLight: number
  const ColorBlendType_LinearLight: number
  const ColorBlendType_Hue: number
  const ColorBlendType_Color: number
  const ColorBlendType_AddCompatible: number
  const ColorBlendType_MultiplyCompatible: number
}