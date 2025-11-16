package com.yoga.dict.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.yoga.dict.ui.viewmodel.AuthViewModel
import com.yoga.dict.ui.viewmodel.AuthUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(
    onRegisterSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    var login by remember { mutableStateOf("") }
    var mail by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    
    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.RegistrationSuccess) {
            onRegisterSuccess()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Регистрация") },
                navigationIcon = {
                    IconButton(onClick = onNavigateToLogin) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (uiState is AuthUiState.Error) {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = (uiState as AuthUiState.Error).message,
                                modifier = Modifier.padding(16.dp),
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }
                    
                    OutlinedTextField(
                        value = login,
                        onValueChange = { login = it },
                        label = { Text("Логин") },
                        leadingIcon = { Icon(Icons.Default.Person, null) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = mail,
                        onValueChange = { mail = it },
                        label = { Text("Email") },
                        leadingIcon = { Icon(Icons.Default.Email, null) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Пароль") },
                        leadingIcon = { Icon(Icons.Default.Lock, null) },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    null
                                )
                            }
                        },
                        visualTransformation = if (passwordVisible) {
                            androidx.compose.ui.text.input.VisualTransformation.None
                        } else {
                            PasswordVisualTransformation()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text("Подтвердите пароль") },
                        leadingIcon = { Icon(Icons.Default.Lock, null) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    Button(
                        onClick = {
                            if (password == confirmPassword && login.isNotBlank() && mail.isNotBlank()) {
                                viewModel.register(login, mail, password)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = uiState !is AuthUiState.Loading && 
                                login.isNotBlank() && 
                                mail.isNotBlank() && 
                                password.isNotBlank() &&
                                password == confirmPassword
                    ) {
                        if (uiState is AuthUiState.Loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Text("Зарегистрироваться")
                        }
                    }
                    
                    TextButton(
                        onClick = onNavigateToLogin,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Уже есть аккаунт? Войти")
                    }
                }
            }
        }
    }
}

