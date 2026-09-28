/** Where the view is: zoom factor over "fit", and the image pixel at the centre of the canvas. */
export interface ViewState {
  zoom: number;
  cx: number;
  cy: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;

export function fitView(width: number, height: number): ViewState {
  return { zoom: 1, cx: width / 2, cy: height / 2 };
}

export interface Rendered {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}
