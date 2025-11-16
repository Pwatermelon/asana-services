package com.yoga.dict.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.yoga.dict.ui.viewmodel.AsanaViewModel
import com.yoga.dict.ui.viewmodel.AsanaUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AsanaDetailScreen(
    asanaId: String,
    onBack: () -> Unit,
    viewModel: AsanaViewModel = hiltViewModel()
) {
    LaunchedEffect(asanaId) {
        viewModel.loadAsanaById(asanaId)
    }
    
    val selectedAsana by viewModel.selectedAsana.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Детали асаны") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Поделиться */ }) {
                        Icon(Icons.Default.Share, contentDescription = "Поделиться")
                    }
                    IconButton(onClick = { /* TODO: Избранное */ }) {
                        Icon(Icons.Default.FavoriteBorder, contentDescription = "Избранное")
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
                    onRetry = { viewModel.loadAsanaById(asanaId) },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            is AsanaUiState.Success -> {
                selectedAsana?.let { asana ->
                    AsanaDetailContent(
                        asana = asana,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues)
                    )
                }
            }
        }
    }
}

@Composable
fun AsanaDetailContent(
    asana: com.yoga.dict.data.model.Asana,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // Фотографии
        if (asana.photos.isNotEmpty()) {
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(asana.photos) { photo ->
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(photo.url)
                            .crossfade(true)
                            .build(),
                        contentDescription = asana.name.displayName,
                        modifier = Modifier
                            .size(300.dp)
                            .clip(RoundedCornerShape(16.dp)),
                        contentScale = ContentScale.Crop
                    )
                }
            }
        }
        
        // Информация
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Название
            Text(
                text = asana.name.displayName,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            
            // Санскрит
            asana.name.name_sanskrit?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            
            // Транслитерация
            asana.name.transliteration?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            // Определение
            asana.name.definition?.let {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
            
            // Источники
            if (asana.sources.isNotEmpty()) {
                Text(
                    text = "Источники:",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                asana.sources.forEach { source ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = source.title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = source.author,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            source.year?.let {
                                Text(
                                    text = "Год: $it",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

