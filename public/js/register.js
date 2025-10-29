document.addEventListener('DOMContentLoaded', function () {
  let currentSection = 0;
  let selectedAccounts = [];

  const monthSelect = document.getElementById('birthMonth');
  const daySelect = document.getElementById('birthDay');
  const yearSelect = document.getElementById('birthYear');

  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  months.forEach((month, index) => {
    monthSelect.innerHTML += `<option value="${index + 1}">${month}</option>`;
  });

  // Dynamically populate days based on selected month and year (handles leap years)
  function updateDays() {
    const month = parseInt(monthSelect.value, 10) || 1;
    const year = parseInt(yearSelect.value, 10) || new Date().getFullYear() - 18;
    const daysInMonth = new Date(year, month, 0).getDate();
    daySelect.innerHTML = '';
    for (let i = 1; i <= daysInMonth; i++) {
      daySelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
  }

  // Initial population
  updateDays();

  // Update days when month or year changes
  monthSelect.addEventListener('change', updateDays);
  yearSelect.addEventListener('change', updateDays);
  
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 18; i >= 1900; i--) {
    yearSelect.innerHTML += `<option value="${i}">${i}</option>`;
  }

  // Country + State logic
  const countrySelect = document.getElementById('country');
  const stateSelect = document.getElementById('state');
  const stateField = document.getElementById('stateField');

  const statesByCountry = {
    US: ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"],
    CA: ["AB","BC","MB","NB","NL","NT","NS","NU","ON","PE","QC","SK","YT"],
    GB: ["England","Scotland","Wales","Northern Ireland"],
    DE: ["Baden-Württemberg","Bavaria","Berlin","Brandenburg","Bremen","Hamburg","Hesse","Lower Saxony","Mecklenburg-Vorpommern","North Rhine-Westphalia","Rhineland-Palatinate","Saarland","Saxony","Saxony-Anhalt","Schleswig-Holstein","Thuringia"]
  };

  countrySelect.addEventListener('change', () => {
    const val = countrySelect.value;
    if (statesByCountry[val]) {
      stateField.style.display = 'block';
      stateSelect.innerHTML = '<option value="">Select State</option>' + 
        statesByCountry[val].map(s => `<option value="${s}">${s}</option>`).join('');
      stateSelect.required = true;
    } else {
      stateField.style.display = 'none';
      stateSelect.required = false;
    }
  });

  // Load saved progress from localStorage
  const savedForm = JSON.parse(localStorage.getItem('signupProgress') || '{}');
  for (const [key, value] of Object.entries(savedForm)) {
    const input = document.getElementById(key);
    if (input) {
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    }
  }

  if (savedForm.selectedAccounts) {
    selectedAccounts = savedForm.selectedAccounts;
    selectedAccounts.forEach(type => {
      const card = document.querySelector(`.account-card[data-account="${type}"]`);
      if (card) card.classList.add('selected');
    });
  }

  // Account selection
  document.querySelectorAll('.account-card').forEach(card => {
    card.addEventListener('click', function () {
      this.classList.toggle('selected');
      selectedAccounts = Array.from(document.querySelectorAll('.account-card.selected'))
        .map(card => card.dataset.account);
      saveProgress();
    });
  });

  // Section navigation functions
  window.showNextSection = function(id) {
    const sections = document.querySelectorAll('.form-section');
    const steps = document.querySelectorAll('.step');
    
    // Update progress steps
    steps.forEach((step, index) => {
      const stepNumber = parseInt(step.querySelector('.step-number').textContent);
      if (stepNumber <= currentSection + 1) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    currentSection++;
  }

  window.showPreviousSection = function() {
    const sections = document.querySelectorAll('.form-section');
    const steps = document.querySelectorAll('.step');
    
    if (currentSection > 0) currentSection--;
    
    // Update progress steps
    steps.forEach((step, index) => {
      const stepNumber = parseInt(step.querySelector('.step-number').textContent);
      if (stepNumber <= currentSection + 1) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    sections.forEach(sec => sec.classList.remove('active'));
    sections[currentSection].classList.add('active');
  }

  window.validateAccountSelection = function() {
    const selected = document.querySelectorAll('.account-card.selected');
    if (selected.length === 0) {
      alert('Please select at least one account type.');
      return;
    }
    selectedAccounts = Array.from(selected).map(card => card.dataset.account);
    saveProgress();
    showNextSection('personalInfo');
  }

  window.validatePersonalInfo = function() {
    const form = document.getElementById('personalInfoForm');
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }
    saveProgress();
    showNextSection('reviewSubmit');
    
    // Update review section
    document.getElementById('selectedAccountsList').innerHTML =
      selectedAccounts.map(acc => 
        `<li>${acc.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>`
      ).join('');
    
    document.getElementById('personalInfoReview').innerHTML = `
      <p><strong>Name:</strong> ${document.getElementById('firstName').value} ${document.getElementById('lastName').value}</p>
      <p><strong>SSN:</strong> ${document.getElementById('ssn').value}</p>
      <p><strong>DOB:</strong> ${document.getElementById('birthMonth').value}/${document.getElementById('birthDay').value}/${document.getElementById('birthYear').value}</p>
      <p><strong>Address:</strong> ${document.getElementById('street').value}, ${document.getElementById('city').value}, ${document.getElementById('zip').value}, ${document.getElementById('country').value} ${document.getElementById('state').value || ''}</p>
      <p><strong>Email:</strong> ${document.getElementById('email').value}</p>
      <p><strong>Phone:</strong> ${document.getElementById('phone').value}</p>
      <p><strong>Dual Citizenship:</strong> ${document.getElementById('dualCitizenship').checked ? 'Yes' : 'No'}</p>
    `;
  }

  window.submitApplication = function() {
    if (!document.getElementById('termsCheck').checked) {
      alert('Please agree to the Terms and Privacy Policy');
      return;
    }
    const email = document.getElementById('email').value;
    document.getElementById('userEmail').textContent = email;
    setTimeout(() => showNextSection('emailVerification'), 300);
  }

  // Updated completeSetup function with success modal
  window.completeSetup = function () {
    const form = document.getElementById('credentialForm');
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Show loading state
    const finishBtn = document.getElementById('finishBtn');
    const originalText = finishBtn.innerHTML;
    finishBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Creating Account...';
    finishBtn.disabled = true;

    fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${firstName} ${lastName}`,
        email: email,
        username: username,
        password: password,
        phone: phone,
        selectedAccounts: selectedAccounts,
        status: "active"
      })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.success) {
        // Show success modal with user details
        showSuccessModal({
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: phone,
          username: username,
          accounts: selectedAccounts
        });
        
        localStorage.setItem('loggedInUser', JSON.stringify(data.user));
        localStorage.setItem('jwt', data.token);
        localStorage.removeItem('signupProgress');
      } else {
        throw new Error(data.message || "Registration failed.");
      }
    })
    .catch(err => {
      console.error("Error registering:", err);
      alert("Registration failed: " + err.message);
      finishBtn.innerHTML = originalText;
      finishBtn.disabled = false;
    });
  }

  // Success modal functions
  function showSuccessModal(userData) {
    // Format data for display
    const maskedEmail = userData.email.replace(/(.{2})(.*)(?=@)/, (match, p1, p2) => 
      p1 + '*'.repeat(p2.length)
    );
    
    const maskedPhone = userData.phone.replace(/\d(?=\d{4})/g, '*');
    
    const formattedAccounts = userData.accounts.map(acc => 
      acc.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    ).join(', ');

    // Populate modal
    document.getElementById('successFullName').textContent = `${userData.firstName} ${userData.lastName}`;
    document.getElementById('successEmail').textContent = maskedEmail;
    document.getElementById('successPhone').textContent = maskedPhone;
    document.getElementById('successUsername').textContent = userData.username;
    document.getElementById('successAccounts').textContent = formattedAccounts;

    // Show modal
    document.getElementById('successModal').classList.add('show');
  }

  // Continue to dashboard
  document.getElementById('continueToDashboard').addEventListener('click', function() {
    window.location.href = "user-dashboard.html";
  });

  function saveProgress() {
    const fields = ['firstName', 'lastName', 'ssn', 'birthMonth', 'birthDay', 'birthYear',
                    'street', 'city', 'zip', 'country', 'state', 'email', 'phone', 'dualCitizenship'];
    const progress = {};
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) progress[id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    progress.selectedAccounts = selectedAccounts;
    localStorage.setItem('signupProgress', JSON.stringify(progress));
  }

  // Event listeners for navigation buttons
  const btnToPersonalInfo = document.getElementById("btnToPersonalInfo");
  const btnToReview = document.getElementById("btnToReview");
  const btnToEmailVerify = document.getElementById("btnToEmailVerify");
  const btnToCredentials = document.getElementById("btnToCredentials");
  const finishBtn = document.getElementById("finishBtn");

  if (btnToPersonalInfo)
    btnToPersonalInfo.addEventListener("click", (e) => {
      e.preventDefault();
      validateAccountSelection();
    });

  if (btnToReview)
    btnToReview.addEventListener("click", (e) => {
      e.preventDefault();
      validatePersonalInfo();
    });

  if (btnToEmailVerify)
    btnToEmailVerify.addEventListener("click", (e) => {
      e.preventDefault();
      submitApplication();
    });

  if (btnToCredentials)
    btnToCredentials.addEventListener("click", (e) => {
      e.preventDefault();
      showNextSection("credentials");
    });

  if (finishBtn) {
    finishBtn.addEventListener("click", function (e) {
      e.preventDefault();
      completeSetup();
    });
  }

  // Initialize country state if saved
  if (savedForm.country && statesByCountry[savedForm.country]) {
    stateField.style.display = 'block';
    stateSelect.innerHTML = '<option value="">Select State</option>' + 
      statesByCountry[savedForm.country].map(s => `<option value="${s}">${s}</option>`).join('');
    if (savedForm.state) {
      stateSelect.value = savedForm.state;
    }
  }
});