// Fix device IDs for both businesses
exports.fixBusinessDeviceIds = functions.https.onRequest(async (req, res) => {
  try {
    // Fix biz_machine_2 device ID back to FC4349999
    await db.collection('businesses').doc('biz_machine_2').collection('devices').doc('admin').delete();
    await db.collection('businesses').doc('biz_machine_2').collection('devices').doc('FC4349999').set({
      deviceId: "FC4349999",
      deviceName: "Machine 2 Device", 
      deviceType: "hikvision",
      status: "active",
      isPlaceholder: false,
      createdAt: new Date().toISOString()
    });

    // Ensure biz_srcomponents has admin device
    await db.collection('businesses').doc('biz_srcomponents').collection('devices').doc('admin').set({
      deviceId: "admin",
      deviceName: "SR Components Admin Device", 
      deviceType: "hikvision",
      status: "active",
      isPlaceholder: false,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, message: "Device IDs fixed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});