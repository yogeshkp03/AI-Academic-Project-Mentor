import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e) {

    e.preventDefault();

    if (email === "" || password === "") {
      alert("Please enter email and password");
      return;
    }

    localStorage.setItem("isLoggedIn", "true");

    navigate("/dashboard");
  }

  return (
    <div className="auth-page">

      <div className="auth-card">

        <Link to="/" className="back-home">
          ← Back to Home
        </Link>

        <div className="auth-icon">
          🤖
        </div>

        <h1>Welcome Back</h1>

        <p>
          Login to continue your academic journey.
        </p>

        <form onSubmit={handleLogin}>

          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <button
            type="submit"
            className="auth-button"
          >
            Login →
          </button>

        </form>

        <p className="auth-switch">

          Don't have an account?

          {" "}

          <Link to="/register">
            Create Account
          </Link>

        </p>

      </div>

    </div>
  );
}

export default Login;






// import { useState } from "react";
// import { Link, useNavigate } from "react-router-dom";

// function Login() {

//   const navigate = useNavigate();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const handleLogin = (e) => {

//     e.preventDefault();

//     if (!email || !password) {
//       alert("Please enter email and password.");
//       return;
//     }

//     // Temporary frontend login
//     localStorage.setItem("isLoggedIn", "true");
//     localStorage.setItem("userEmail", email);

//     navigate("/dashboard");
//   };

//   return (

//     <div className="auth-page">

//       <div className="auth-background"></div>

//       <div className="auth-card animate-card">

//         <Link to="/" className="back-home">
//           ← Back to Home
//         </Link>

//         <div className="auth-icon">
//           🤖
//         </div>

//         <h1>Welcome Back</h1>

//         <p>
//           Continue your academic journey with AI.
//         </p>

//         <form onSubmit={handleLogin}>

//           <label>Email Address</label>

//           <input
//             type="email"
//             placeholder="you@example.com"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//           />

//           <label>Password</label>

//           <input
//             type="password"
//             placeholder="Enter your password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//           />

//           <div className="forgot-password">
//             <a href="#forgot">
//               Forgot password?
//             </a>
//           </div>

//           <button
//             type="submit"
//             className="auth-button"
//           >
//             Login →
//           </button>

//         </form>

//         <div className="divider">
//           <span>OR</span>
//         </div>

//         <p className="auth-switch">

//           Don't have an account?

//           {" "}

//           <Link to="/register">
//             Create Account
//           </Link>

//         </p>

//       </div>

//     </div>
//   );
// }

// export default Login;




// import { useState } from "react";

// function Login() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const handleLogin = (e) => {
//     e.preventDefault();

//     console.log("Login:", {
//       email,
//       password,
//     });

//     alert("Login button clicked!");
//   };

//   return (
//     <div className="auth-page">
//       <div className="auth-card">

//         <h1>Welcome Back 👋</h1>

//         <p>Login to your AI Project Tracker</p>

//         <form onSubmit={handleLogin}>

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
//             placeholder="Enter your password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />

//           <button type="submit">
//             Login
//           </button>

//         </form>

//         <p className="auth-switch">
//           Don't have an account?
//           <a href="/register"> Create Account</a>
//         </p>

//       </div>
//     </div>
//   );
// }

// export default Login;