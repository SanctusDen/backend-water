const { ctrlWrapper } = require("../helpers");
const { HttpError } = require("../helpers");
const { Water } = require("../models/water");


const findExistingEntryAndCalculateOldAmount = async (waterId) => {
  const existingEntry = await Water.findOne({ "entries._id": waterId });

  if (!existingEntry) {
    throw HttpError(404, "Not found");
  }

  const oldAmountWater = existingEntry.entries.find(
    (entry) => entry._id.toString() === waterId
  ).amountWater;
  return oldAmountWater;
};

const addWater = async (req, res, next) => {
  const { _id: owner } = req.user;
  const { amountWater, day } = req.body;

  const existingWaterData = await Water.findOne({ owner });

  if (existingWaterData) {
    const updatedResult = await Water.findOneAndUpdate(
      { owner },
      {
        $push: { entries: { amountWater, day } },
        $inc: { totalAmountWater: amountWater },
      },
      { new: true }
    );

    res.status(201).json(updatedResult);
  } else {
    const result = await Water.create({
      entries: [{ amountWater, day }],
      totalAmountWater: amountWater,
      owner,
    });
    res.status(201).json(result);
  }
};

const updateWater = async (req, res) => {
  const { waterId } = req.params;
  const { amountWater } = req.body;

  const oldAmountWater = await findExistingEntryAndCalculateOldAmount(waterId);

  const result = await Water.findOneAndUpdate(
    { "entries._id": waterId },
    {
      $set: { "entries.$[elem].amountWater": amountWater },
      $inc: { totalAmountWater: amountWater - oldAmountWater },
    },
    {
      arrayFilters: [{ "elem._id": waterId }],
      new: true,
    }
  );

  res.json(result);
};

const deleteWater = async (req, res) => {
  const { waterId } = req.params;

  const oldAmountWater = await findExistingEntryAndCalculateOldAmount(waterId);

  const result = await Water.findOneAndUpdate(
    { "entries._id": waterId },
    {
      $pull: { entries: { _id: waterId } },
      $inc: { totalAmountWater: -oldAmountWater },
    },
    { new: true }
  );

  res.json(result);
};

const getToday = async (req, res) => {
  const { _id: owner } = req.user;

  const date = new Date();
  const waterData = await Water.findOne({
      date: {
          $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      },
      owner,
  });

  if (!waterData) {
      res.json({
          waterAll: 0,
          percentage: 0,
          entries: [],
      });
      return;
  }

  const totalAmountWater = waterData.totalAmountWater || 0;
  const dailyNorma = waterData.dailyNorma || 1;

  const dailyWater = {
      totalWater: waterData.entries.length,
      percentage: Math.floor((totalAmountWater / (dailyNorma * 1000)) * 100),
      entries: waterData.entries,
  };

  res.json(dailyWater);
}
module.exports = {
  addWater: ctrlWrapper(addWater),
  updateWater: ctrlWrapper(updateWater),
  deleteWater: ctrlWrapper(deleteWater),
  getToday: ctrlWrapper(getToday),
};
