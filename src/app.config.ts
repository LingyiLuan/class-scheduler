export default defineAppConfig({
  cloud: true,
  pages: [
    'pages/index/index',
    'pages/pending/index',
    'pages/students/list/index',
    'pages/students/form/index',
    'pages/students/detail/index',
    'pages/recharge/index',
    'pages/schedule/index',
    'pages/course/detail/index',
    'pages/course/new/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '排课',
    navigationBarTextStyle: 'black'
  }
})
