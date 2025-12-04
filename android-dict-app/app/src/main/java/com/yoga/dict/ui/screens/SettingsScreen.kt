package com.yoga.dict.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.foundation.clickable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.yoga.dict.ui.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onNavigateToModeration: () -> Unit,
    onNavigateToAbout: () -> Unit,
    onNavigateToInstructions: () -> Unit,
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val userLogin by authViewModel.userLogin.collectAsStateWithLifecycle()
    val userRole by authViewModel.userRole.collectAsStateWithLifecycle()
    val isAdmin by remember { derivedStateOf { userRole == "admin" } }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Настройки") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Информация о пользователе
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Пользователь: ${userLogin ?: "Неавторизованный пользователь"}",
                        style = MaterialTheme.typography.titleMedium
                    )
                    userRole?.let { role ->
                        Text(
                            text = "Роль: ${if (role == "admin") "Администратор" else if (role == "expert") "Эксперт" else role}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
            
            // Меню настроек
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ListItem(
                    headlineContent = { Text("О проекте") },
                    leadingContent = { Icon(Icons.Default.Info, null) },
                    modifier = Modifier.clickable { onNavigateToAbout() }
                )
                
                if (isAdmin || userRole == "expert") {
                    ListItem(
                        headlineContent = { Text("Инструкции для экспертов") },
                        leadingContent = { Icon(Icons.Default.MenuBook, null) },
                        modifier = Modifier.clickable { onNavigateToInstructions() }
                    )
                    
                    ListItem(
                        headlineContent = { Text("Модерация") },
                        leadingContent = { Icon(Icons.Default.Verified, null) },
                        modifier = Modifier.clickable { onNavigateToModeration() }
                    )
                }
                
                Divider()
                
                ListItem(
                    headlineContent = { Text("Выйти") },
                    leadingContent = { Icon(Icons.Default.ExitToApp, null) },
                    modifier = Modifier.clickable { authViewModel.logout() }
                )
            }
        }
    }
}

