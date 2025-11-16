package com.yoga.dict.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddSourceScreen(
    onBack: () -> Unit,
    onSuccess: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Добавить источник") },
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
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Добавление источника",
                style = MaterialTheme.typography.headlineMedium
            )
            
            Text(
                text = "Функционал добавления источника будет реализован позже",
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

