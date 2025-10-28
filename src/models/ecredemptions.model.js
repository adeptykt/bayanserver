// redemptions-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
    const mongooseClient = app.get('mongooseClient');
    const { Schema } = mongooseClient;
    const ecredemptions = new Schema({
        certificateId: { type: global.mongoose.Schema.ObjectId, required: true },
        sum: { type: Number },
        store: { type: String, required: true },
        docType: { type: String },
        docNumber: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    });

    return mongooseClient.model('ecredemptions', ecredemptions);
};
