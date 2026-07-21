export default defineAppConfig({
  cloud: true,
  pages: [
    'pages/index/index',
    'pages/pending/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '排课',
    navigationBarTextStyle: 'black'
  }
})
