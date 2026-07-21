export default defineAppConfig({
  cloud: true,
  pages: [
    'pages/index/index',
    'pages/pending/index',
    'pages/students/list/index',
    'pages/students/detail/index',
    'pages/schedule/index',
    'pages/course/detail/index',
    'pages/stats/index',
    'pages/settings/index',
    'pages/messages/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '排课',
    navigationBarTextStyle: 'black'
  }
})
