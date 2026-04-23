export const FONTS = {
  regular: "AlibabaSans-Regular",
  semiBold: "AlibabaSans-SemiBold",
  bold: "AlibabaSans-Bold",
} as const;

/* eslint-disable @typescript-eslint/no-require-imports */
export const fontAssets = {
  [FONTS.regular]: require("../assets/fonts/Alibaba_B2B_Sans_Regular.ttf"),
  [FONTS.semiBold]: require("../assets/fonts/Alibaba_B2B_Sans_SemiBold.ttf"),
  [FONTS.bold]: require("../assets/fonts/Alibaba_B2B_Sans_Bold.ttf"),
};
/* eslint-enable @typescript-eslint/no-require-imports */
