module.exports = async (arr, func) => {
  for (let i = 0, l = arr.length; i < l; i++) {
    await func(arr[i], i, arr);
  }
};
