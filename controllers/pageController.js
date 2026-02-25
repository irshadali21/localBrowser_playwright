const { listPages, requestPage, closeChat } = require('../utils/pageManager');

exports.list = (req, res) => {
  const pages = listPages();
  res.json({ pages });
};

exports.request = async (req, res, next) => {
  const type = req.query.type;
  if (!type) return res.status(400).json({ error: 'type query required' });
  try {
    const { id } = await requestPage(type);
    res.json({ pageId: id });
  } catch (err) {
    next(err);
  }
};

exports.close = async (req, res, next) => {
  try {
    await closeChat();
    res.json({ status: 'pages closed' });
  } catch (err) {
    console.error('[ChatController] Close error:', err);
    next(err);
  }
};