import {createContext} from 'react';
import type React from 'react';
import type {Scene} from './types';

/** Lets one scene show another: a recap puts moments from earlier scenes beside its takeaways. */
/**
 * How far a scene has faded in or out, for the scenes that have to apply it themselves. An animation
 * is laid over the backdrop with a lighten blend; fading its parent would cut that blend off from the
 * backdrop, and the grid behind it would vanish in one frame. So the clip takes the fade directly.
 */
export const FadeContext = createContext(1);

export const StageContext = createContext<{scenes: Scene[]; render: (scene: Scene) => React.ReactNode}>({scenes: [], render: () => null});
