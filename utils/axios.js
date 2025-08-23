const axios = require("axios");
const { USE_MOCK_IMAGE_SERVICE } = require("../consts");
const api = axios.create();

const isConvertImageToTextUrl = (url) => url?.includes("/scan-receipt")

api.interceptors.request.use((config) => {
  if (USE_MOCK_IMAGE_SERVICE && isConvertImageToTextUrl(config.url)) {
    return Promise.resolve({
      __isMock: true,
      data: { items: [
        { name: "סביצ'", price: 29, quantity: 1 },
        { name: "טבולה", price: 24, quantity: 1 },
        { name: "שרימסס", price: 22, quantity: 1 },
        { name: "ה פילה דגי6", price: 25, quantity: 1 },
        { name: "ה סוכריה", price: 17, quantity: 1 },
      ], }
    });
  }

  return config;
});

module.exports = api;
