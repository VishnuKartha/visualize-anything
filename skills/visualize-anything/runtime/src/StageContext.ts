import {createContext} from 'react';
import type React from 'react';
import type {Scene} from './types';

/** Lets one scene show another: a recap puts moments from earlier scenes beside its takeaways. */
export const StageContext = createContext<{scenes: Scene[]; render: (scene: Scene) => React.ReactNode}>({scenes: [], render: () => null});
