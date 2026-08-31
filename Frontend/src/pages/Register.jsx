import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {

  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = (e) => {

    e.preventDefault();

    if (!name || !email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userPassword", password);

    alert("Account created successfully! 🎉");

    navigate("/login");
  };

  return (

    <div className="auth-page">

      <div className="auth-background"></div>

      <div className="auth-card animate-card">

        <Link to="/" className="back-home">
          ← Back to Home
        </Link>

        <div className="auth-icon">
          🎓
        </div>

        <h1>Create Account</h1>

        <p>
          Start managing your academic projects.
        </p>

        <form onSubmit={handleRegister}>

          <label>Full Name</label>

          <input
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label>Email Address</label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="auth-button"
          >
            Create Account →
          </button>

        </form>

        <p className="auth-switch">

          Already have an account?

          {" "}

          <Link to="/login">
            Login
          </Link>

        </p>

      </div>

    </div>
  );
}

export default Register;








// import { useState } from "react";

// function Register() {

//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const handleRegister = (e) => {
//     e.preventDefault();

//     console.log({
//       name,
//       email,
//       password,
//     });

//     alert("Registration button clicked!");
//   };

//   return (
//     <div className="auth-page">

//       <div className="auth-card">

//         <h1>Create Account 🎓</h1>

//         <p>Start managing your academic projects</p>

//         <form onSubmit={handleRegister}>

//           <label>Full Name</label>

//           <input
//             type="text"
//             placeholder="Enter your name"
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//             required
//           />

//           <label>Email</label>

//           <input
//             type="email"
//             placeholder="Enter your email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />

//           <label>Password</label>

//           <input
//             type="password"
//             placeholder="Create a password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />

//           <button type="submit">
//             Create Account
//           </button>

//         </form>

//         <p className="auth-switch">
//           Already have an account?
//           <a href="/login"> Login</a>
//         </p>

//       </div>

//     </div>
//   );
// }

// export default Register;