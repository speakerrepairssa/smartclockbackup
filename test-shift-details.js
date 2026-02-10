// Get shift schedule details
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBssR7qaFYd1Bcm7urHQrKfLPVvdoZJ1kw",
  authDomain: "aiclock-82608.firebaseapp.com",
  databaseURL: "https://aiclock-82608-default-rtdb.firebaseio.com",
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "847148296718",
  appId: "1:847148296718:web:a8bf69cb527ee7c7e1ea5f",
  measurementId: "G-L6LMK5WY01"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getShiftDetails() {
  try {
    const businessId = 'biz_machine_2';
    const shiftId = 'M00DnBlwQmQJbuPHD4sX'; // From the test output above

    console.log('=== SHIFT SCHEDULE DETAILS ===');
    console.log(`Business ID: ${businessId}`);
    console.log(`Shift ID: ${shiftId}`);
    console.log('');

    const shiftRef = doc(db, "businesses", businessId, "shifts", shiftId);
    const shiftSnap = await getDoc(shiftRef);

    if (shiftSnap.exists()) {
      const shift = shiftSnap.data();
      console.log(`Shift Name: ${shift.shiftName}`);
      console.log(`Default Break Duration: ${shift.defaultBreakDuration} minutes`);
      console.log('');
      console.log('Weekly Schedule:');
      console.log('================');

      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      dayNames.forEach(day => {
        const daySchedule = shift.schedule[day];
        if (daySchedule && daySchedule.enabled) {
          const breakDuration = daySchedule.breakDuration || shift.defaultBreakDuration || 60;

          // Calculate hours
          const [startH, startM] = daySchedule.startTime.split(':').map(Number);
          const [endH, endM] = daySchedule.endTime.split(':').map(Number);

          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          const workMinutes = endMinutes - startMinutes;
          const actualMinutes = workMinutes - breakDuration;
          const hours = actualMinutes / 60;

          console.log(`${day.toUpperCase()}: ${daySchedule.startTime} - ${daySchedule.endTime} (break: ${breakDuration}min) = ${hours.toFixed(2)}h`);
        } else {
          console.log(`${day.toUpperCase()}: OFF (0 hours)`);
        }
      });

      // Now calculate for Feb 1-8, 2026
      console.log('');
      console.log('=== MANUAL CALCULATION FOR FEB 1-8, 2026 ===');

      const today = new Date(2026, 1, 9); // Feb 9, 2026
      const monthStart = new Date(2026, 1, 1); // Feb 1, 2026
      const yesterday = new Date(2026, 1, 8); // Feb 8, 2026

      let totalRequired = 0;
      const currentDate = new Date(monthStart);

      while (currentDate <= yesterday) {
        const dayOfWeek = currentDate.getDay();
        const dayName = dayNames[dayOfWeek];
        const daySchedule = shift.schedule[dayName];

        let hoursForDay = 0;
        if (daySchedule && daySchedule.enabled) {
          const breakDuration = daySchedule.breakDuration || shift.defaultBreakDuration || 60;
          const [startH, startM] = daySchedule.startTime.split(':').map(Number);
          const [endH, endM] = daySchedule.endTime.split(':').map(Number);

          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          const workMinutes = endMinutes - startMinutes;
          const actualMinutes = workMinutes - breakDuration;
          hoursForDay = actualMinutes / 60;
        }

        totalRequired += hoursForDay;
        console.log(`${currentDate.toDateString()} (${dayName}): ${hoursForDay.toFixed(2)}h`);

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('');
      console.log(`TOTAL REQUIRED FEB 1-8: ${totalRequired.toFixed(2)}h`);
      console.log('');
      console.log('Employee "test 1hr" worked: 13h');
      console.log(`Past due should be: ${totalRequired.toFixed(2)} - 13 = ${(totalRequired - 13).toFixed(2)}h`);
      console.log(`System calculated: 32h`);
      console.log(`Difference: ${Math.abs(totalRequired - 13 - 32).toFixed(2)}h`);

    } else {
      console.log('❌ Shift not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

getShiftDetails();
