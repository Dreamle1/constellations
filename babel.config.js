module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
            '@types': './src/types',
          },
        },
      ],
      // Reanimated / worklets plugins are added automatically by babel-preset-expo (must stay last).
    ],
  };
};
