// babel-preset-taro 更多选项和默认值：
// https://github.com/NervJS/taro/blob/next/packages/babel-preset-taro/README.md
module.exports = {
  presets: [
    ['taro', {
      framework: 'react',
      ts: true
    }]
  ],
  plugins: [
    // NutUI 按需引入：只打包用到的组件及其样式，避免全量 style.css（~292KB）进主包
    [
      'import',
      {
        libraryName: '@nutui/nutui-react-taro',
        libraryDirectory: 'dist/es/packages',
        style: 'css',
        camel2DashComponentName: false,
        // 组件目录为全小写无连字符（button/cellgroup/…），故直接小写化匹配
        customName: (name) => `@nutui/nutui-react-taro/dist/es/packages/${name.toLowerCase()}`
      },
      'nutui-react-taro'
    ]
  ]
}
