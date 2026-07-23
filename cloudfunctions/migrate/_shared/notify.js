/**
 * 消息中心写入。sync:cloud 复制进各云函数后 require('./_shared/notify')。
 * 写入发生在业务事件处，不依赖订阅消息推送是否成功——额度断了信息也不丢（应用内兜底）。
 * 依赖调用方 index.js 已执行 cloud.init()。
 */
const cloud = require('wx-server-sdk')
const { WS_STAMP } = require('./workspace')

/**
 * @param {object} o
 * @param {string} o.ownerId  收件人 openid
 * @param {string} o.type     classReminder / lowCredit / creditDeducted ...
 * @param {string} o.title
 * @param {string} o.body
 * @param {string} [o.refType] session / student
 * @param {string} [o.refId]
 */
async function addNotification({ ownerId, type, title, body, refType, refId }) {
  const db = cloud.database()
  try {
    await db.collection('notifications').add({
      data: {
        ...WS_STAMP,
        ownerId,
        type: type || 'info',
        title: title || '',
        body: body || '',
        refType: refType || null,
        refId: refId || null,
        readAt: null,
        createdAt: db.serverDate()
      }
    })
  } catch (e) {
    console.error('[notify] 写 notifications 失败', e && e.message)
  }
}

module.exports = { addNotification }
