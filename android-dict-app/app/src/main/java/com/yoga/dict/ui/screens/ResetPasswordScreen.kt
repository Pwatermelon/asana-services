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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.yoga.dict.ui.viewmodel.AuthViewModel
import com.yoga.dict.ui.viewmodel.AuthUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ResetPasswordScreen(
    onBack: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    var login by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Восстановление пароля") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
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
                    Text(
                        text = "Введите логин или email для восстановления пароля",
                        style = MaterialTheme.typography.bodyLarge
                    )
                    
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
                    
                    if (uiState is AuthUiState.ResetPasswordSent) {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Инструкции по восстановлению пароля отправлены на email",
                                modifier = Modifier.padding(16.dp),
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                    
                    OutlinedTextField(
                        value = login,
                        onValueChange = { login = it },
                        label = { Text("Логин или Email") },
                        leadingIcon = { Icon(Icons.Default.Person, null) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    Button(
                        onClick = {
                            if (login.isNotBlank()) {
                                viewModel.resetPasswordRequest(login)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = uiState !is AuthUiState.Loading && login.isNotBlank()
                    ) {
                        if (uiState is AuthUiState.Loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Text("Отправить")
                        }
                    }
                }
            }
        }
    }
}

