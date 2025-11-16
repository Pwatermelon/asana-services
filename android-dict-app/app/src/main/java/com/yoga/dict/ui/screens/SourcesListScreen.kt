package com.yoga.dict.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.yoga.dict.data.model.Source
import com.yoga.dict.ui.viewmodel.SourcesViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SourcesListScreen(
    onSourceClick: (Source) -> Unit,
    onAddSource: () -> Unit,
    viewModel: SourcesViewModel = hiltViewModel()
) {
    val sources by viewModel.sources.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val isExpertOrAdmin by viewModel.isExpertOrAdmin.collectAsStateWithLifecycle()
    
    LaunchedEffect(Unit) {
        viewModel.loadSources()
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Источники") },
                actions = {
                    if (isExpertOrAdmin) {
                        IconButton(onClick = onAddSource) {
                            Icon(Icons.Default.Add, contentDescription = "Добавить")
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            if (isExpertOrAdmin) {
                FloatingActionButton(onClick = onAddSource) {
                    Icon(Icons.Default.Add, contentDescription = "Добавить источник")
                }
            }
        }
    ) { paddingValues ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(sources) { source ->
                    SourceCard(
                        source = source,
                        onClick = { onSourceClick(source) },
                        onDelete = if (isExpertOrAdmin) {
                            { viewModel.deleteSource(source.id) }
                        } else null
                    )
                }
            }
        }
    }
}

@Composable
fun SourceCard(
    source: Source,
    onClick: () -> Unit,
    onDelete: (() -> Unit)? = null
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = source.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = source.author,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                source.year?.let {
                    Text(
                        text = "Год: $it",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            if (onDelete != null) {
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Удалить")
                }
            }
        }
    }
}

