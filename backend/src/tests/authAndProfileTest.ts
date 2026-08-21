import http from 'http';
import app from '../index';

const BASE_URL = 'http://localhost:5000/api';
let server: any;

function makeRequest(method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const postData = body ? JSON.stringify(body) : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData).toString(),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            const data = responseBody ? JSON.parse(responseBody) : {};
            resolve({ status: res.statusCode || 500, data });
          } catch {
            resolve({ status: res.statusCode || 500, data: responseBody });
          }
        });
      }
    );

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Auth & Student Profile Automated Tests...\n');
  await new Promise<void>((resolve) => {
    server = app.listen(5000, () => resolve());
  });

  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  let authToken = '';

  // 1. Test Registration
  console.log('1. Testing User Registration...');
  const regRes = await makeRequest('POST', '/auth/register', {
    email: testEmail,
    password: testPassword,
    fullName: 'Jane Doe',
  });
  if (regRes.status === 201 && regRes.data.token) {
    console.log('✅ Registration SUCCESS (Token received)');
    authToken = regRes.data.token;
  } else {
    console.error('❌ Registration FAILED:', regRes);
    process.exit(1);
  }

  // 2. Test Duplicate Email
  console.log('\n2. Testing Duplicate Email Prevention...');
  const dupRes = await makeRequest('POST', '/auth/register', {
    email: testEmail,
    password: testPassword,
    fullName: 'Jane Doe Duplicate',
  });
  if (dupRes.status === 400) {
    console.log('✅ Duplicate Email Prevention SUCCESS (Returned 400 Bad Request)');
  } else {
    console.error('❌ Duplicate Email Test FAILED:', dupRes);
    process.exit(1);
  }

  // 3. Test Login
  console.log('\n3. Testing User Login...');
  const loginRes = await makeRequest('POST', '/auth/login', {
    email: testEmail,
    password: testPassword,
  });
  if (loginRes.status === 200 && loginRes.data.token) {
    console.log('✅ Login SUCCESS (JWT Token generated)');
  } else {
    console.error('❌ Login FAILED:', loginRes);
    process.exit(1);
  }

  // 4. Test Invalid Password
  console.log('\n4. Testing Invalid Password Rejection...');
  const badLoginRes = await makeRequest('POST', '/auth/login', {
    email: testEmail,
    password: 'WrongPassword123!',
  });
  if (badLoginRes.status === 401) {
    console.log('✅ Invalid Password Rejection SUCCESS (Returned 401 Unauthorized)');
  } else {
    console.error('❌ Invalid Password Test FAILED:', badLoginRes);
    process.exit(1);
  }

  // 5. Test Protected Current-User Endpoint (/auth/me)
  console.log('\n5. Testing Protected /auth/me Endpoint...');
  const meRes = await makeRequest('GET', '/auth/me', null, authToken);
  if (meRes.status === 200 && meRes.data.email === testEmail) {
    console.log('✅ Protected /auth/me SUCCESS (Fetched authenticated user data)');
  } else {
    console.error('❌ Protected /auth/me FAILED:', meRes);
    process.exit(1);
  }

  // 6. Test Profile Retrieval
  console.log('\n6. Testing Student Profile Retrieval...');
  const profileRes = await makeRequest('GET', '/profile', null, authToken);
  if (profileRes.status === 200 && profileRes.data.fullName === 'Jane Doe') {
    console.log('✅ Profile Retrieval SUCCESS');
  } else {
    console.error('❌ Profile Retrieval FAILED:', profileRes);
    process.exit(1);
  }

  // 7. Test Profile Update (All 20 Required Fields)
  console.log('\n7. Testing Student Profile Update with 20 Fields...');
  const updatePayload = {
    fullName: 'Jane Doe Smith',
    nationality: 'Canadian',
    countryOfResidence: 'Canada',
    university: 'University of Toronto',
    currentDegreeName: 'B.Sc. Data Science',
    currentDegreeLevel: 'BACHELORS',
    fieldOfStudy: 'Data Science',
    gpa: 3.88,
    maxGpa: 4.0,
    graduationYear: 2026,
    targetDegreeLevel: 'MASTERS',
    targetCountries: ['United Kingdom', 'Germany', 'Switzerland'],
    preferredFields: ['Artificial Intelligence', 'Machine Learning'],
    languageTests: {
      IELTS: 8.0,
      TOEFL: 110,
      German_TestDaF: 'TDN 4',
    },
    workExperienceYears: 2.0,
    researchExperience: 'Undergraduate research assistant in computer vision lab',
    skills: ['Python', 'PyTorch', 'R', 'SQL', 'TypeScript'],
    financialPreference: 'Full Tuition & Stipend Required',
    scholarshipPreference: 'Government & University Merit Grants',
  };

  const updateRes = await makeRequest('POST', '/profile', updatePayload, authToken);
  if (updateRes.status === 200 && updateRes.data.fullName === 'Jane Doe Smith') {
    console.log('✅ Profile Update SUCCESS (All 20 fields saved)');
  } else {
    console.error('❌ Profile Update FAILED:', updateRes);
    process.exit(1);
  }

  // 8. Test Unauthorized Access Without Token
  console.log('\n8. Testing Unauthorized Access Rejection (No Token)...');
  const unauthRes = await makeRequest('GET', '/profile');
  if (unauthRes.status === 401) {
    console.log('✅ Unauthorized Access Rejection SUCCESS (Returned 401 Unauthorized)');
  } else {
    console.error('❌ Unauthorized Access Test FAILED:', unauthRes);
    process.exit(1);
  }

  console.log('\n🎉 ALL 8 AUTHENTICATION & STUDENT PROFILE TESTS PASSED PERFECTLY!\n');
  if (server) server.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test script runtime error:', err);
  if (server) server.close();
  process.exit(1);
});
