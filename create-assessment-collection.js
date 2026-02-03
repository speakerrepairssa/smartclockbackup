// Script to create sample assessment collection data
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

console.log('🚀 Starting assessment collection creation...');

const firebaseConfig = {
  apiKey: "AIzaSyBtlxL6ZhConEWI8bOhFxlWqt-a_Nt03ag",
  authDomain: "aiclock-82608.firebaseapp.com", 
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "778031738932",
  appId: "1:778031738932:web:cbb9b34c5c2b93d1c6eb14"
};

console.log('⚙️ Initializing Firebase...');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createAssessmentData() {
  try {
    const businessId = "biz_srcomponents";
    const currentMonth = "2026-02"; // February 2026
    
    // Sample assessment data for 3 employees
    const assessmentData = [
      {
        month: currentMonth,
        employeeIndex: 1,
        employeeName: "John Smith",
        requiredHours: 176,
        actualHours: 165,
        hoursShort: 11,
        payRate: 35.00,
        totalPay: 5775.00,
        status: "behind"
      },
      {
        month: currentMonth,
        employeeIndex: 2,
        employeeName: "Sarah Johnson", 
        requiredHours: 176,
        actualHours: 180,
        hoursShort: 0,
        payRate: 32.00,
        totalPay: 5760.00,
        status: "on_track"
      },
      {
        month: currentMonth,
        employeeIndex: 3,
        employeeName: "Mike Davis",
        requiredHours: 176,
        actualHours: 120,
        hoursShort: 56,
        payRate: 30.00,
        totalPay: 3600.00,
        status: "critical"
      }
    ];

    // Create documents in the assessment subcollection
    for (let i = 0; i < assessmentData.length; i++) {
      const data = assessmentData[i];
      const docRef = doc(db, "businesses", businessId, "assessment", `${currentMonth}-emp${data.employeeIndex}`);
      
      await setDoc(docRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Created assessment document for ${data.employeeName}`);
    }
    
    console.log("🎉 Assessment collection created successfully!");
    console.log(`📍 Collection path: businesses/${businessId}/assessment`);
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error creating assessment data:", error);
    process.exit(1);
  }
}

createAssessmentData();