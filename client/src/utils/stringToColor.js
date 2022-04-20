/* eslint-disable no-bitwise */
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += (`00${value.toString(16)}`).substr(-2);
  }
  return color;
};

export default stringToColor;
