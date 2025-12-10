package com.yoga.dict.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.yoga.dict.data.model.Asana
import com.yoga.dict.ui.viewmodel.AsanaViewModel
import com.yoga.dict.ui.viewmodel.AsanaUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SourceAsanasScreen(
    sourceId: String,
    onBack: () -> Unit,
    viewModel: AsanaViewModel = hiltViewModel()
) {
    LaunchedEffect(sourceId) {
        if (sourceId.isNotEmpty()) {
            viewModel.loadAsanasBySource(sourceId)
        }
    }
    
    val asanaList by viewModel.asanaList.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Асаны источника") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            is AsanaUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is AsanaUiState.Error -> {
                val errorState = uiState as AsanaUiState.Error
                ErrorMessage(
                    message = errorState.message,
                    onRetry = { /* TODO */ },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            is AsanaUiState.Success -> {
                if (asanaList.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Нет асан для этого источника")
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                    items(asanaList) { asana ->
                        AsanaCard(
                            asana = asana,
                            onClick = { /* Navigate to detail if needed */ },
                            onLongPress = { _, _ -> /* No action */ },
                            showSources = false,
                            showPhoto = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    }
                }
            }
        }
    }
}

