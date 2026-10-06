import { useId } from 'react';

/** useId() without the colons, so it can be used in SVG url(#id) references. */
export const useSvgId = (prefix = 'g') => prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '');
