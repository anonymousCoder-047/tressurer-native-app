import React from 'react';
import Svg, { Circle, Rect } from 'react-native-svg';

export default function TressurerLogo({ size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={48} fill="#2563EB" />
      {/* T — top bar + stem (stem doubles as a chart bar) */}
      <Rect x={29} y={23} width={42} height={9} rx={1.5} fill="#FFFFFF" />
      <Rect x={45.5} y={23} width={9} height={47} rx={1.5} fill="#FFFFFF" />
      {/* gold ascending bars flanking the T stem */}
      <Rect x={31.5} y={61} width={9} height={9} rx={1.5} fill="#F59E0B" />
      <Rect x={59.5} y={47} width={9} height={23} rx={1.5} fill="#F59E0B" />
    </Svg>
  );
}
