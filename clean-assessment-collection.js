// Script to clean and recreate assessment collection
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

console.log('🧹 Cleaning assessment collection...');

const firebaseConfig = {
  apiKey: "AIzaSyBtlxL6ZhConEWI8bOhFxlWqt-a_Nt03ag",
  authDomain: "aiclock-82608.firebaseapp.com", 
  projectId: "aiclock-82608",
  storageBucket: "aiclock-82608.appspot.com",
  messagingSenderId: "778031738932",
  appId: "1:778031738932:web:cbb9b34c5c2b93d1c6eb14"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanAndRecreateAssessment() {
  try {
    const businessId = "biz_srcomponents";
    
    // Step 1: Delete all existing assessment documents
    console.log('🗑️ Deleting old assessment documents...');
    const assessmentRef = collection(db, "businesses", businessId, "assessment");
    const snapshot = await getDocs(assessmentRef);
    
    const deletePromises = [];
    snapshot.forEach((docSnap) => {
      console.log(`Deleting: ${docSnap.id}`);
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${deletePromises.length} old documents`);
    
    // Step 2: Create fresh assessment data for January 2026
    const currentMonth = "2026-01";
    console.log(`📝 Creating fresh assessment data for ${currentMonth}...`);
    
    const assessmentData = [
      {
        month: currentMonth,
        employeeId: "1",
        employeeName: "azam",
        employeeIndex: 1,
        requiredHours: 176,
        actualHours: 165,
        hoursShort: 11,
        payRate: 35.00,
        totalPay: 5775.00,
        status: "behind",
        attendanceStatus: "active"
      },
      {
        month: currentMonth,
        employeeId: "2",
        employeeName: "Employee 2",
        employeeIndex: 2,
        requiredHours: 176,
        actualHours: 180,
        hoursShort: 0,
        payRate: 32.00,
        totalPay: 5760.00,
        status: "on_track",
        attendanceStatus: "active"
      },
      {
        month: currentMonth,
        employeeId: "3",
        employeeName: "Employee 3",
        employeeIndex: 3,
        requiredHours: 176,
        actualHours: 120,
        hoursShort: 56,
        payRate: 30.00,
        totalPay: 3600.00,
        status: "critical",
        attendanceStatus: "active"
      }
    ];

    // Create new documents
    for (const data of assessmentData) {
      const docId = `${currentMonth}-emp${data.employeeId}`;
      const docRef = doc(db, "businesses", businessId, "assessment", docId);
      
      await setDoc(docRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Created: ${docId} - ${data.employeeName}`);
    }
    
    console.log("🎉 Assessment collection cleaned and recreated successfully!");
    console.log(`📍 Collection: businesses/${businessId}/assessment`);
    console.log(`📅 Month: ${currentMonth}`);
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error cleaning assessment collection:", error);
    process.exit(1);
  }
}

cleanAndRecreateAssessment();