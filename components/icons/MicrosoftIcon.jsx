import React from 'react';
import Svg, { Rect } from 'react-native-svg';

// Official Microsoft logo — four squares in the brand colors
// (red, green, blue, yellow) at 1px internal gutters on a 21x21 grid.
export default function MicrosoftIcon({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 21 21">
      <Rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <Rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      <Rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      <Rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </Svg>
  );
}
