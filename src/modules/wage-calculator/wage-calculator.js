// Wage Calculator Module
class WageCalculator {
  constructor() {
    this.constants = {
      WEEKS_PER_MONTH: 4.33,
      OVERTIME_MULTIPLIER: 1.5,
      DOUBLE_TIME_MULTIPLIER: 2.0
    };
    console.log('💰 Wage Calculator initialized');
  }

  /**
   * Initialize the wage calculator module
   */
  init() {
    console.log('📊 Setting up wage calculator...');
    this.setupEventListeners();
    this.loadSavedValues();
    console.log('✅ Wage calculator ready');
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Monthly to Hourly calculator
    const calculateHourlyBtn = document.getElementById('calculateHourlyBtn');
    const weeklyHoursSelect = document.getElementById('weeklyHours');
    
    if (calculateHourlyBtn) {
      calculateHourlyBtn.addEventListener('click', () => this.calculateHourlyRate());
    }
    
    if (weeklyHoursSelect) {
      weeklyHoursSelect.addEventListener('change', (e) => {
        const customGroup = document.getElementById('customHoursGroup');
        if (customGroup) {
          customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        }
      });
    }

    // Hourly to Monthly calculator
    const calculateMonthlyBtn = document.getElementById('calculateMonthlyBtn');
    const weeklyHoursSelect2 = document.getElementById('weeklyHours2');
    
    if (calculateMonthlyBtn) {
      calculateMonthlyBtn.addEventListener('click', () => this.calculateMonthlySalary());
    }
    
    if (weeklyHoursSelect2) {
      weeklyHoursSelect2.addEventListener('change', (e) => {
        const customGroup2 = document.getElementById('customHoursGroup2');
        if (customGroup2) {
          customGroup2.style.display = e.target.value === 'custom' ? 'block' : 'none';
        }
      });
    }

    // Overtime calculator
    const calculateOvertimeBtn = document.getElementById('calculateOvertimeBtn');
    if (calculateOvertimeBtn) {
      calculateOvertimeBtn.addEventListener('click', () => this.calculateOvertime());
    }

    // Auto-calculate on Enter key
    const inputs = document.querySelectorAll('.calculator-inputs input');
    inputs.forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const card = input.closest('.calculator-card');
          const calculateBtn = card.querySelector('.btn-calculate');
          if (calculateBtn) calculateBtn.click();
        }
      });
    });
  }

  /**
   * Get weekly hours from select or custom input
   */
  getWeeklyHours(selectId, customInputId) {
    const select = document.getElementById(selectId);
    if (!select) return 40;
    
    if (select.value === 'custom') {
      const customInput = document.getElementById(customInputId);
      return parseFloat(customInput?.value) || 40;
    }
    
    return parseFloat(select.value);
  }

  /**
   * Calculate hourly rate from monthly salary
   */
  calculateHourlyRate() {
    const monthlySalary = parseFloat(document.getElementById('monthlySalary')?.value) || 0;
    
    if (monthlySalary <= 0) {
      alert('Please enter a valid monthly salary');
      return;
    }

    const weeklyHours = this.getWeeklyHours('weeklyHours', 'customWeeklyHours');
    const monthlyHours = weeklyHours * this.constants.WEEKS_PER_MONTH;
    const hourlyRate = monthlySalary / monthlyHours;
    const dailyRate = hourlyRate * 8;
    const weeklyRate = hourlyRate * weeklyHours;
    const overtimeRate = hourlyRate * this.constants.OVERTIME_MULTIPLIER;
    const doubleTimeRate = hourlyRate * this.constants.DOUBLE_TIME_MULTIPLIER;

    // Display results
    document.getElementById('hourlyRate').textContent = `R${hourlyRate.toFixed(2)}/hour`;
    document.getElementById('dailyRate').textContent = `R${dailyRate.toFixed(2)}/day`;
    document.getElementById('weeklyRate').textContent = `R${weeklyRate.toFixed(2)}/week`;
    document.getElementById('monthlyHours').textContent = `${monthlyHours.toFixed(1)}h/month`;
    document.getElementById('overtimeRate').textContent = `R${overtimeRate.toFixed(2)}/hour`;
    document.getElementById('doubleTimeRate').textContent = `R${doubleTimeRate.toFixed(2)}/hour`;

    // Show results
    document.getElementById('hourlyResults').style.display = 'block';

    // Save values
    this.saveValues('monthly', { monthlySalary, weeklyHours, hourlyRate });
  }

  /**
   * Calculate monthly salary from hourly rate
   */
  calculateMonthlySalary() {
    const hourlyRate = parseFloat(document.getElementById('hourlyRateInput')?.value) || 0;
    
    if (hourlyRate <= 0) {
      alert('Please enter a valid hourly rate');
      return;
    }

    const weeklyHours = this.getWeeklyHours('weeklyHours2', 'customWeeklyHours2');
    const monthlyHours = weeklyHours * this.constants.WEEKS_PER_MONTH;
    const monthlySalary = hourlyRate * monthlyHours;
    const dailyRate = hourlyRate * 8;
    const weeklyRate = hourlyRate * weeklyHours;
    const annualSalary = monthlySalary * 12;
    const overtimeRate = hourlyRate * this.constants.OVERTIME_MULTIPLIER;
    const doubleTimeRate = hourlyRate * this.constants.DOUBLE_TIME_MULTIPLIER;

    // Display results
    document.getElementById('monthlySalaryResult').textContent = `R${monthlySalary.toFixed(2)}/month`;
    document.getElementById('dailyRate2').textContent = `R${dailyRate.toFixed(2)}/day`;
    document.getElementById('weeklyRate2').textContent = `R${weeklyRate.toFixed(2)}/week`;
    document.getElementById('annualSalary').textContent = `R${annualSalary.toFixed(2)}/year`;
    document.getElementById('overtimeRate2').textContent = `R${overtimeRate.toFixed(2)}/hour`;
    document.getElementById('doubleTimeRate2').textContent = `R${doubleTimeRate.toFixed(2)}/hour`;

    // Show results
    document.getElementById('monthlyResults').style.display = 'block';

    // Save values
    this.saveValues('hourly', { hourlyRate, weeklyHours, monthlySalary });
  }

  /**
   * Calculate overtime pay
   */
  calculateOvertime() {
    const baseRate = parseFloat(document.getElementById('baseHourlyRate')?.value) || 0;
    const regularHours = parseFloat(document.getElementById('regularHours')?.value) || 0;
    const overtimeHours = parseFloat(document.getElementById('overtimeHours')?.value) || 0;
    const doubleTimeHours = parseFloat(document.getElementById('doubleTimeHours')?.value) || 0;

    if (baseRate <= 0) {
      alert('Please enter a valid base hourly rate');
      return;
    }

    const overtimeRate = baseRate * this.constants.OVERTIME_MULTIPLIER;
    const doubleTimeRate = baseRate * this.constants.DOUBLE_TIME_MULTIPLIER;

    const regularPay = regularHours * baseRate;
    const overtimePay = overtimeHours * overtimeRate;
    const doubleTimePay = doubleTimeHours * doubleTimeRate;
    const totalPay = regularPay + overtimePay + doubleTimePay;
    const totalHours = regularHours + overtimeHours + doubleTimeHours;

    // Display breakdown
    document.getElementById('regHoursDisplay').textContent = regularHours.toFixed(1);
    document.getElementById('regRateDisplay').textContent = baseRate.toFixed(2);
    document.getElementById('regularPay').textContent = `R${regularPay.toFixed(2)}`;

    document.getElementById('otHoursDisplay').textContent = overtimeHours.toFixed(1);
    document.getElementById('otRateDisplay').textContent = overtimeRate.toFixed(2);
    document.getElementById('overtimePay').textContent = `R${overtimePay.toFixed(2)}`;

    document.getElementById('dtHoursDisplay').textContent = doubleTimeHours.toFixed(1);
    document.getElementById('dtRateDisplay').textContent = doubleTimeRate.toFixed(2);
    document.getElementById('doubleTimePay').textContent = `R${doubleTimePay.toFixed(2)}`;

    document.getElementById('totalPay').textContent = `R${totalPay.toFixed(2)}`;
    document.getElementById('totalHoursWorked').textContent = `${totalHours.toFixed(1)} hours`;

    // Show results
    document.getElementById('overtimeResults').style.display = 'block';

    // Save values
    this.saveValues('overtime', { baseRate, regularHours, overtimeHours, doubleTimeHours });
  }

  /**
   * Save calculator values to localStorage
   */
  saveValues(type, values) {
    try {
      localStorage.setItem(`wageCalc_${type}`, JSON.stringify(values));
    } catch (error) {
      console.error('Error saving calculator values:', error);
    }
  }

  /**
   * Load saved values from localStorage
   */
  loadSavedValues() {
    try {
      // Load monthly calculator
      const monthlyData = localStorage.getItem('wageCalc_monthly');
      if (monthlyData) {
        const data = JSON.parse(monthlyData);
        const input = document.getElementById('monthlySalary');
        if (input && data.monthlySalary) {
          input.value = data.monthlySalary;
        }
      }

      // Load hourly calculator
      const hourlyData = localStorage.getItem('wageCalc_hourly');
      if (hourlyData) {
        const data = JSON.parse(hourlyData);
        const input = document.getElementById('hourlyRateInput');
        if (input && data.hourlyRate) {
          input.value = data.hourlyRate;
        }
      }

      // Load overtime calculator
      const overtimeData = localStorage.getItem('wageCalc_overtime');
      if (overtimeData) {
        const data = JSON.parse(overtimeData);
        if (data.baseRate) {
          const input = document.getElementById('baseHourlyRate');
          if (input) input.value = data.baseRate;
        }
      }
    } catch (error) {
      console.error('Error loading saved values:', error);
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount) {
    return `R${amount.toFixed(2)}`;
  }

  /**
   * Export calculation results
   */
  exportResults(type) {
    // Export results as text or PDF
    console.log(`Exporting ${type} results...`);
    // Implementation for export functionality
  }
}

// Initialize when module is loaded
let wageCalculatorInstance = null;

window.initWageCalculator = function() {
  if (!wageCalculatorInstance) {
    wageCalculatorInstance = new WageCalculator();
  }
  wageCalculatorInstance.init();
  return wageCalculatorInstance;
};

// Export for use in other modules
export default WageCalculator;
