// @ts-nocheck
/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 *
 * Adapted for AlgoArena: single Haru model, assets served from /public/live2d,
 * no background/gear sprites, no audio.
 */

import { LogLevel } from '@framework/live2dcubismframework';

// Canvas size: 'auto' means follow the hosting element's client size.
export const CanvasSize: { width: number; height: number } | 'auto' = 'auto';

// Number of canvases.
export const CanvasNum = 1;

// View scale.
export const ViewScale = 1.0;
export const ViewMaxScale = 2.0;
export const ViewMinScale = 0.8;

export const ViewLogicalLeft = -1.0;
export const ViewLogicalRight = 1.0;
export const ViewLogicalBottom = -1.0;
export const ViewLogicalTop = 1.0;

export const ViewLogicalMaxLeft = -2.0;
export const ViewLogicalMaxRight = 2.0;
export const ViewLogicalMaxBottom = -2.0;
export const ViewLogicalMaxTop = 2.0;

// Resources are served from frontend/public/live2d/
export const ResourcesPath = '/live2d/';

// Shader relative path.
export const ShaderPath = '/live2d/shaders/WebGL/';

// Model definition.
// Directory name and model3.json name must match.
export const ModelDir: string[] = ['Haru', 'Hiyori', 'Mao', 'zundamon', 'koharu'];
export const ModelDirSize: number = ModelDir.length;

// Must match model3.json motion group / hit area names.
export const MotionGroupIdle = 'Idle';
export const MotionGroupTapBody = 'TapBody';

export const HitAreaNameHead = 'Head';
export const HitAreaNameBody = 'Body';

// Motion priority constants.
export const PriorityNone = 0;
export const PriorityIdle = 1;
export const PriorityNormal = 2;
export const PriorityForce = 3;

// MOC3 / motion consistency validation options.
export const MOCConsistencyValidationEnable = true;
export const MotionConsistencyValidationEnable = true;

// Debug logging options.
export const DebugLogEnable = false;
export const DebugTouchLogEnable = false;

// Framework log level.
export const CubismLoggingLevel: LogLevel = LogLevel.LogLevel_Error;

// Default render target size.
export const RenderTargetWidth = 1900;
export const RenderTargetHeight = 1000;