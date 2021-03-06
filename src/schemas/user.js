module.exports = {
    phone: { type: String, required: true, unique: true },
    role: { type: String, required: true, trim: true },
    isEnabled: { type: Boolean, default: true },
    username: { type: String },
    name: { type: String, trim: true },
    surname: { type: String, trim: true },
    patronymic: { type: String, trim: true },
    region: { type: String, trim: true },
    email: { type: String },
    password: { type: String },
    scores: { type: Number, default: 0 },
    birthDate: { type: Date },
    birthday: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    card: { type: String },
    sms: { type: Boolean },
    group: [ Number ],
};
