<?php
/**
 * SOCIOBEAST GENESIS v11 — Admin Login
 */
session_start();
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = $_POST['password'] ?? '';
    $storedHash = getConfig('admin_password', '');
    
    if (password_verify($password, $storedHash)) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_login_time'] = time();
        header('Location: index.php');
        exit;
    } else {
        $error = 'Invalid password';
    }
}

// Check if already logged in
if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SocioBeast Admin Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0f0a 0%, #1a251a 100%);
            color: #d0e8d0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-box {
            background: rgba(20, 30, 20, 0.9);
            border: 1px solid rgba(112, 184, 112, 0.3);
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            text-align: center;
        }
        h1 { color: #70b870; margin-bottom: 10px; }
        p { color: #708070; margin-bottom: 30px; }
        input {
            width: 100%;
            padding: 14px;
            margin-bottom: 20px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(112, 184, 112, 0.3);
            border-radius: 8px;
            color: #d0e8d0;
            font-size: 16px;
        }
        input:focus { outline: none; border-color: #70b870; }
        button {
            width: 100%;
            background: linear-gradient(135deg, #4a7c4a 0%, #3a5c3a 100%);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover { background: linear-gradient(135deg, #5a8c5a 0%, #4a6c4a 100%); }
        .error {
            background: rgba(200, 80, 80, 0.2);
            border: 1px solid rgba(200, 80, 80, 0.5);
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 20px;
            color: #e88;
        }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>🌲 SocioBeast</h1>
        <p>Admin Access</p>
        
        <?php if ($error): ?>
        <div class="error"><?= clean($error) ?></div>
        <?php endif; ?>
        
        <form method="POST">
            <input type="password" name="password" placeholder="Admin Password" required autofocus>
            <button type="submit">Enter the Forest</button>
        </form>
    </div>
</body>
</html>
