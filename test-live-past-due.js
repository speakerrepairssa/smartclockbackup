// Test live past due hours calculation from Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, query, where } from "firebase/firestore";

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

async function testLivePastDue() {
  try {
    const businessId = 'biz_machine_2';
    const month = '2026-02'; // February 2026

    console.log('=== LIVE PAST DUE HOURS TEST ===');
    console.log(`Business ID: ${businessId}`);
    console.log(`Month: ${month}`);
    console.log('');

    // Get assessment cache
    console.log('📊 Fetching assessment cache...');
    const cacheRef = doc(db, "businesses", businessId, "assessment_cache", month);
    const cacheSnap = await getDoc(cacheRef);

    if (cacheSnap.exists()) {
      const cacheData = cacheSnap.data();
      console.log('✅ Found cached assessment');
      console.log(`Last updated: ${cacheData.lastUpdated}`);
      console.log('');

      console.log('=== EMPLOYEES WITH PAST DUE HOURS ===');
      cacheData.employees.forEach((emp, idx) => {
        console.log(`\n${idx + 1}. ${emp.employeeName} (Slot ${emp.employeeIndex})`);
        console.log(`   Required Hours: ${emp.requiredHours}`);
        console.log(`   Current Hours: ${emp.currentHours}`);
        console.log(`   Past Due Hours: ${emp.pastDueHours}`);
        console.log(`   Hours Short: ${emp.hoursShort}`);
        console.log(`   Status: ${emp.status}`);

        if (emp.shiftId) {
          console.log(`   Shift ID: ${emp.shiftId}`);
        }
      });

      // Check if we can get shift data for Employee 4 (test1hr)
      console.log('\n=== CHECKING SHIFT DATA ===');
      const staffRef = collection(db, "businesses", businessId, "staff");
      const staffSnap = await getDocs(staffRef);

      staffSnap.forEach(async (staffDoc) => {
        const staff = staffDoc.data();
        if (staff.employeeName && staff.employeeName.toLowerCase().includes('test')) {
          console.log(`\nFound employee: ${staff.employeeName}`);
          console.log(`  Shift ID: ${staff.shiftId || 'Not assigned'}`);

          if (staff.shiftId) {
            const shiftRef = doc(db, "businesses", businessId, "shifts", staff.shiftId);
            const shiftSnap = await getDoc(shiftRef);

            if (shiftSnap.exists()) {
              const shift = shiftSnap.data();
              console.log(`  Shift Name: ${shift.shiftName}`);
              console.log(`  Schedule:`);
              Object.keys(shift.schedule).forEach(day => {
                const daySchedule = shift.schedule[day];
                if (daySchedule.enabled) {
                  console.log(`    ${day}: ${daySchedule.startTime} - ${daySchedule.endTime} (break: ${daySchedule.breakDuration || shift.defaultBreakDuration}min)`);
                } else {
                  console.log(`    ${day}: OFF`);
                }
              });
            }
          }
        }
      });

    } else {
      console.log('❌ No cached assessment found');
      console.log('Try running: node calculate-assessment-cache.js');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testLivePastDue();
